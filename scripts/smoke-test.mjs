const gateway=process.env.GATEWAY_URL||'http://localhost:4000';
const username=process.env.AUTH_USERNAME||'akash';
const password=process.env.AUTH_PASSWORD||'interviewdrill';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function waitFor(url,label,attempts=60){
  for(let i=0;i<attempts;i++){
    try{
      const response=await fetch(url);
      if(response.ok){
        console.log('ready:',label);
        return;
      }
    }catch{}
    await sleep(1000);
  }
  throw new Error(`${label} did not become ready`);
}

async function json(url,options={}){
  const response=await fetch(url,options);
  const body=await response.json().catch(()=>null);
  if(!response.ok){
    throw new Error(`${options.method||'GET'} ${url} failed: ${response.status} ${JSON.stringify(body)}`);
  }
  return {body,response};
}

await waitFor(gateway+'/health','gateway');
await waitFor('http://localhost:4001/health','content-service');
await waitFor('http://localhost:4002/health','session-service');
await waitFor('http://localhost:4003/health','evaluation-service');
await waitFor('http://localhost:4004/health','progress-service');
await waitFor('http://localhost:4005/health','admin-service');
await waitFor('http://localhost:5173','frontend');

const login=await json(gateway+'/api/auth/login',{
  method:'POST',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({username,password})
});
const access=login.body.data.access_token;
if(!access)throw new Error('Gateway did not return an access token');
const auth={Authorization:'Bearer '+access,'Content-Type':'application/json'};

const list=await json(gateway+'/api/content/projects?category=snippet',{headers:auth});
const projects=list.body.data;
if(!Array.isArray(projects)||!projects.length)throw new Error('Seeded snippet project was not returned');

const selected=projects.find(project=>project.title==='Express Error Handler Drill')||projects[0];
const detail=await json(gateway+'/api/content/projects/'+selected.id,{headers:auth});
const project=detail.body.data;
if(!project.files?.length)throw new Error('Snippet project has no seeded files');

const started=await json(gateway+'/api/sessions',{
  method:'POST',
  headers:auth,
  body:JSON.stringify({
    project_id:project.id,
    time_limit_seconds:120,
    recall:false
  })
});
const session=started.body.data;
const units=session.reference_snapshot?.units;
if(!units?.length)throw new Error('Session reference snapshot has no units');

const submission=units.map(unit=>({
  file_id_ref:unit.id,
  typed_code:unit.reference_code,
  typed_path:unit.path||unit.name
}));

await json(gateway+`/api/sessions/${session.id}/submit`,{
  method:'POST',
  headers:auth,
  body:JSON.stringify({files:submission})
});

let report=null;
for(let i=0;i<40;i++){
  const response=await fetch(gateway+`/api/evaluations/session/${session.id}`,{headers:auth});
  if(response.ok){
    report=(await response.json()).data;
    break;
  }
  if(response.status!==404){
    throw new Error(`Evaluation polling failed with ${response.status}`);
  }
  await sleep(500);
}

if(!report)throw new Error('Evaluation report was not produced');
if(Number(report.overall_accuracy)!==100){
  throw new Error(`Expected 100 accuracy, got ${report.overall_accuracy}`);
}
if(Number(report.completion_pct)!==100){
  throw new Error(`Expected 100 completion, got ${report.completion_pct}`);
}
if(Number(report.structure_score)!==100){
  throw new Error(`Expected 100 structure score, got ${report.structure_score}`);
}

for(let i=0;i<40;i++){
  const progress=await fetch(gateway+'/api/progress/dashboard',{headers:auth});
  if(progress.ok){
    const data=(await progress.json()).data;
    if(data.stats?.some(stat=>stat.category==='snippet'&&Number(stat.sessions_completed)>=1)){
      console.log('progress pipeline verified');
      break;
    }
  }
  if(i===39)throw new Error('Progress Service did not consume evaluation.completed');
  await sleep(500);
}

console.log('InterviewDrill smoke test passed');
