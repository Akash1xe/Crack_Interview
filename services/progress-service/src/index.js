import express from 'express';
import { createClient } from 'redis';
import { pool } from './db.js';

const app=express();
const port=Number(process.env.PORT||4004);
const sessionUrl=process.env.SESSION_SERVICE_URL||'http://localhost:4002';
const evaluationUrl=process.env.EVALUATION_SERVICE_URL||'http://localhost:4003';
const redis=createClient({url:process.env.REDIS_URL||'redis://localhost:6379'});
redis.on('error',error=>console.error('Redis error',error));
await redis.connect();

const ok=(res,data,status=200)=>res.status(status).json({success:true,data,error:null});
const fail=(res,status,error)=>res.status(status).json({success:false,data:null,error});

async function fetchJson(url){
  const response=await fetch(url);
  if(!response.ok)throw new Error('Upstream request failed: '+url);
  return (await response.json()).data;
}

async function applyEvaluation(event){
  const sessionId=event.session_id;
  const exists=await pool.query('SELECT session_id FROM progress_events WHERE session_id=$1',[sessionId]);
  if(exists.rowCount)return;

  const [session,report]=await Promise.all([
    fetchJson(`${sessionUrl}/sessions/${sessionId}`),
    fetchJson(`${evaluationUrl}/reports/session/${sessionId}`)
  ]);

  const totalChars=session.files.reduce((sum,file)=>sum+(file.typed_code||'').length,0);
  const minutes=Math.max(1/60,Number(report.time_used_seconds||1)/60);
  const wpm=(totalChars/5)/minutes;
  const accuracy=Number(report.overall_accuracy||0);
  const userId=event.user_id||session.user_id;
  const category=event.category||session.category;

  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO progress_events(session_id,user_id,category,accuracy,wpm)
       VALUES($1,$2,$3,$4,$5)`,
      [sessionId,userId,category,accuracy,wpm]
    );
    await client.query(
      `INSERT INTO user_stats(user_id,category,avg_accuracy,avg_wpm,sessions_completed)
       VALUES($1,$2,$3,$4,1)
       ON CONFLICT(user_id,category) DO UPDATE SET
         avg_accuracy=((user_stats.avg_accuracy*user_stats.sessions_completed)+EXCLUDED.avg_accuracy)/(user_stats.sessions_completed+1),
         avg_wpm=((user_stats.avg_wpm*user_stats.sessions_completed)+EXCLUDED.avg_wpm)/(user_stats.sessions_completed+1),
         sessions_completed=user_stats.sessions_completed+1,
         updated_at=now()`,
      [userId,category,accuracy,wpm]
    );

    for(const file of report.files){
      for(const key of file.mistakes_json||[]){
        const normalized=String(key);
        if(!normalized||normalized==='none')continue;
        await client.query(
          `INSERT INTO mistake_patterns(user_id,pattern_key,occurrence_count,last_seen_at)
           VALUES($1,$2,1,now())
           ON CONFLICT(user_id,pattern_key) DO UPDATE SET
             occurrence_count=mistake_patterns.occurrence_count+1,
             last_seen_at=now()`,
          [userId,normalized]
        );
      }
    }

    await client.query('COMMIT');
  }catch(error){
    await client.query('ROLLBACK');
    throw error;
  }finally{client.release();}
}

async function consumerLoop(){
  let lastId='0-0';
  while(true){
    try{
      const streams=await redis.xRead([{key:'evaluation.completed',id:lastId}],{BLOCK:5000,COUNT:10});
      if(!streams)continue;
      for(const stream of streams){
        for(const message of stream.messages){
          lastId=message.id;
          try{await applyEvaluation(message.message);}
          catch(error){console.error('Progress update failed',message.message.session_id,error);}
        }
      }
    }catch(error){
      console.error('Progress consumer error',error);
      await new Promise(resolve=>setTimeout(resolve,1000));
    }
  }
}

app.get('/health',(_req,res)=>ok(res,{service:'progress-service',ok:true}));

app.get('/dashboard',async(req,res,next)=>{
  try{
    const userId=req.headers['x-user-id']||'dev-user';
    const [stats,mistakes,events]=await Promise.all([
      pool.query('SELECT * FROM user_stats WHERE user_id=$1 ORDER BY category',[userId]),
      pool.query('SELECT * FROM mistake_patterns WHERE user_id=$1 ORDER BY occurrence_count DESC,last_seen_at DESC LIMIT 12',[userId]),
      pool.query('SELECT * FROM progress_events WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20',[userId])
    ]);
    ok(res,{stats:stats.rows,mistakes:mistakes.rows,events:events.rows.reverse()});
  }catch(error){next(error);}
});

app.get('/focus',async(req,res,next)=>{
  try{
    const userId=req.headers['x-user-id']||'dev-user';
    const result=await pool.query(
      'SELECT pattern_key,occurrence_count,last_seen_at FROM mistake_patterns WHERE user_id=$1 ORDER BY occurrence_count DESC,last_seen_at DESC LIMIT 8',
      [userId]
    );
    ok(res,result.rows);
  }catch(error){next(error);}
});

app.use((error,_req,res,_next)=>{
  console.error(error);
  fail(res,500,'Progress service error');
});

app.listen(port,()=>console.log(`Progress Service listening on :${port}`));
consumerLoop();
