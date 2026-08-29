import express from 'express';
import { createClient } from 'redis';
import { pool } from './db.js';

const app = express();
const port = Number(process.env.PORT || 4002);
const contentUrl = process.env.CONTENT_SERVICE_URL || 'http://localhost:4001';
const redis = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
redis.on('error', error => console.error('Redis error', error));
await redis.connect();

app.use(express.json({ limit: '4mb' }));
const ok=(res,data,status=200)=>res.status(status).json({success:true,data,error:null});
const fail=(res,status,error)=>res.status(status).json({success:false,data:null,error});

async function getSession(id){
  const session=await pool.query('SELECT * FROM sessions WHERE id=$1',[id]);
  if(!session.rowCount)return null;
  const files=await pool.query('SELECT id,session_id,file_id_ref,typed_code,typed_path,submitted_at FROM session_files WHERE session_id=$1 ORDER BY id',[id]);
  return {...session.rows[0],files:files.rows};
}

app.get('/health',(_req,res)=>ok(res,{service:'session-service',ok:true}));

app.post('/sessions',async(req,res,next)=>{
  try{
    const userId=req.headers['x-user-id']||'dev-user';
    const {project_id,time_limit_seconds}=req.body;
    if(!project_id||!time_limit_seconds)return fail(res,400,'project_id and time_limit_seconds are required');

    const contentResponse=await fetch(`${contentUrl}/projects/${project_id}`);
    if(!contentResponse.ok)return fail(res,404,'Project not found in Content Service');
    const project=(await contentResponse.json()).data;

    const units=project.category==='lld'
      ? project.lld_classes.map(c=>({
          id:c.id,
          path:c.name,
          name:c.name,
          reference_code:c.reference_code,
          language:'cpp',
          order_index:c.order_index,
          pattern_tag:c.pattern_tag,
          unit_type:'class'
        }))
      : project.files.map(f=>({...f,unit_type:'file'}));

    const snapshot={
      project_id:project.id,
      title:project.title,
      description:project.description||'',
      category:project.category,
      difficulty:project.difficulty,
      units
    };

    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      const created=await client.query(
        `INSERT INTO sessions(user_id,project_id,category,time_limit_seconds,reference_snapshot)
         VALUES($1,$2,$3,$4,$5::jsonb) RETURNING *`,
        [userId,project.id,project.category,time_limit_seconds,JSON.stringify(snapshot)]
      );
      const session=created.rows[0];
      for(const unit of units){
        await client.query(
          `INSERT INTO session_files(session_id,file_id_ref,typed_code,typed_path)
           VALUES($1,$2,'',$3)`,
          [session.id,unit.id,unit.unit_type==='class'?unit.name:unit.path]
        );
      }
      await client.query('COMMIT');
      ok(res,await getSession(session.id),201);
    }catch(error){
      await client.query('ROLLBACK');
      throw error;
    }finally{client.release();}
  }catch(error){next(error);}
});

app.get('/sessions/:id',async(req,res,next)=>{
  try{
    const session=await getSession(req.params.id);
    if(!session)return fail(res,404,'Session not found');
    if(session.status==='in_progress'){
      const expiresAt=new Date(session.started_at).getTime()+session.time_limit_seconds*1000;
      if(Date.now()>=expiresAt){
        await pool.query("UPDATE sessions SET status='expired',ended_at=COALESCE(ended_at,now()) WHERE id=$1",[req.params.id]);
        session.status='expired';
        session.ended_at=new Date().toISOString();
      }
    }
    ok(res,session);
  }catch(error){next(error);}
});

app.patch('/sessions/:id/files/:fileId',async(req,res,next)=>{
  try{
    const {typed_code='',typed_path=''}=req.body;
    const result=await pool.query(
      'UPDATE session_files SET typed_code=$1,typed_path=$2 WHERE session_id=$3 AND file_id_ref=$4 RETURNING *',
      [typed_code,typed_path,req.params.id,req.params.fileId]
    );
    if(!result.rowCount)return fail(res,404,'Session unit not found');
    ok(res,result.rows[0]);
  }catch(error){next(error);}
});

app.post('/sessions/:id/submit',async(req,res,next)=>{
  try{
    const current=await getSession(req.params.id);
    if(!current)return fail(res,404,'Session not found');
    if(current.status!=='in_progress')return fail(res,409,`Session already ${current.status}`);

    const submittedFiles=Array.isArray(req.body.files)?req.body.files:[];
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      for(const file of submittedFiles){
        await client.query(
          `UPDATE session_files SET typed_code=$1,typed_path=$2,submitted_at=now()
           WHERE session_id=$3 AND file_id_ref=$4`,
          [file.typed_code||'',file.typed_path||'',req.params.id,file.file_id_ref]
        );
      }
      await client.query("UPDATE sessions SET status='submitted',ended_at=now() WHERE id=$1",[req.params.id]);
      await client.query('COMMIT');
    }catch(error){
      await client.query('ROLLBACK');
      throw error;
    }finally{client.release();}

    await redis.xAdd('session.submitted','*',{
      session_id:req.params.id,
      user_id:current.user_id,
      project_id:current.project_id,
      category:current.category
    });
    ok(res,await getSession(req.params.id));
  }catch(error){next(error);}
});

app.use((error,_req,res,_next)=>{
  console.error(error);
  fail(res,500,'Session service error');
});

app.listen(port,()=>console.log(`Session Service listening on :${port}`));
