'use client';
import {useEffect,useMemo,useState} from 'react';
import {Bar,BarChart,CartesianGrid,Line,LineChart,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';
import {CodeDiff,CodeEditor} from './CodeEditor';
import {textMetrics} from '@/lib/scoring.mjs';

async function request(path,options={}){
  const response=await fetch(path,options);
  const body=await response.json();
  if(response.status===401){window.location.href='/login';throw new Error('Session expired');}
  if(!response.ok)throw new Error(body.error||'Request failed');
  return body.data;
}

const titles={snippet:'Snippet Drills',machine_coding:'Machine Coding',lld:'LLD Practice'};
const fmt=s=>Math.floor(s/60)+':'+String(s%60).padStart(2,'0');

function Dashboard({goPractice}){
  const[data,setData]=useState({stats:[],mistakes:[],events:[]});
  const[projects,setProjects]=useState([]);
  useEffect(()=>{Promise.all([request('/api/progress'),request('/api/projects')]).then(([p,x])=>{setData(p);setProjects(x);});},[]);
  const focus=useMemo(()=>{
    const keys=data.mistakes.slice(0,6).map(x=>String(x.pattern_key).replace('pattern:','').toLowerCase());
    return projects.filter(p=>keys.some(k=>(p.tags||[]).join(' ').toLowerCase().includes(k)||(k==='missing_async'&&(p.tags||[]).includes('express')))).slice(0,6);
  },[data,projects]);
  const trend=data.events.map((e,i)=>({n:i+1,accuracy:Number(e.overall_accuracy),wpm:Number(e.avg_wpm)}));

  return <section>
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs uppercase tracking-[.2em] text-zinc-500">Progress</p><h2 className="mt-2 text-4xl font-black">Dashboard</h2></div>
      <button className="btn" onClick={()=>goPractice('snippet')}>Start a drill</button>
    </div>
    <div className="mt-6 grid gap-4 md:grid-cols-3">
      {data.stats.length?data.stats.map(s=><div className="card" key={s.category}>
        <div className="text-xs uppercase text-zinc-500">{titles[s.category]||s.category}</div>
        <div className="mt-2 text-3xl font-black">{Number(s.avg_accuracy).toFixed(1)}%</div>
        <div className="mt-2 text-sm text-zinc-400">{Number(s.avg_wpm).toFixed(1)} WPM · {s.sessions_completed} sessions</div>
      </div>):<div className="card text-zinc-400">Complete a session to build your progress history.</div>}
    </div>
    <div className="mt-6 grid gap-5 lg:grid-cols-2">
      <div className="card"><h3 className="font-bold">Accuracy / WPM trend</h3><div className="mt-4 h-64">{trend.length?
        <ResponsiveContainer width="100%" height="100%"><LineChart data={trend}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="n"/><YAxis/><Tooltip/><Line dataKey="accuracy"/><Line dataKey="wpm"/></LineChart></ResponsiveContainer>
        :<p className="text-sm text-zinc-500">No evaluated sessions yet.</p>}</div></div>
      <div className="card"><h3 className="font-bold">Mistake patterns</h3><div className="mt-4 space-y-2">{data.mistakes.length?data.mistakes.map(m=>
        <div className="flex justify-between rounded-xl bg-zinc-950 p-3 text-sm" key={m.pattern_key}><span className="font-mono">{m.pattern_key}</span><span className="text-zinc-500">×{m.occurrence_count}</span></div>
      ):<p className="text-sm text-zinc-500">No recurring mistakes yet.</p>}</div></div>
    </div>
    <div className="card mt-6"><h3 className="font-bold">Focus Drill</h3><p className="mt-1 text-sm text-zinc-500">Projects matched to your common mistakes.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">{focus.length?focus.map(p=><button onClick={()=>goPractice(p.category)} className="rounded-xl border border-zinc-800 p-4 text-left hover:border-zinc-600" key={p.id}><div className="text-xs text-zinc-500">{p.category}</div><div className="mt-1 font-bold">{p.title}</div></button>):<p className="text-sm text-zinc-500">Practice more sessions to unlock focused suggestions.</p>}</div>
    </div>
  </section>;
}

function Practice({initialMode}){
  const[mode,setMode]=useState(initialMode);
  const[projects,setProjects]=useState([]);
  const[preview,setPreview]=useState(null);
  const[session,setSession]=useState(null);
  const[activeId,setActiveId]=useState('');
  const[typed,setTyped]=useState({});
  const[paths,setPaths]=useState({});
  const[left,setLeft]=useState(0);
  const[recall,setRecall]=useState(false);
  const[previewSeconds,setPreviewSeconds]=useState(10);
  const[hidden,setHidden]=useState(false);
  const[report,setReport]=useState(null);
  const[message,setMessage]=useState('');
  const[submitting,setSubmitting]=useState(false);

  useEffect(()=>{setPreview(null);setSession(null);setReport(null);request('/api/projects?category='+mode).then(setProjects).catch(e=>setMessage(e.message));},[mode]);
  const units=session?.reference_snapshot?.units||[];
  const active=units.find(u=>u.id===activeId)||units[0]||null;

  useEffect(()=>{
    if(!session||session.status!=='in_progress')return;
    const tick=()=>{
      const elapsed=Math.floor((Date.now()-new Date(session.started_at).getTime())/1000);
      setLeft(Math.max(0,session.time_limit_seconds-elapsed));
      if(session.recall)setHidden(elapsed>=session.recall_preview_seconds);
    };
    tick();const timer=setInterval(tick,500);return()=>clearInterval(timer);
  },[session]);

  useEffect(()=>{
    if(!session)return;
    localStorage.setItem('interviewdrill:'+session.id,JSON.stringify({typed,paths,activeId}));
  },[session,typed,paths,activeId]);

  async function openProject(item){
    try{setPreview(await request('/api/projects/'+item.id));setMessage('');}catch(e){setMessage(e.message);}
  }

  async function start(){
    try{
      const created=await request('/api/sessions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
        project_id:preview.id,time_limit_seconds:preview.estimated_minutes*60,mode:'evaluation',recall,recall_preview_seconds:previewSeconds
      })});
      setSession(created);setLeft(created.time_limit_seconds);setHidden(false);setReport(null);setTyped({});
      const first=created.reference_snapshot.units[0];
      setActiveId(first?.id||'');
      setPaths(Object.fromEntries(created.reference_snapshot.units.map(u=>[u.id,mode==='machine_coding'?'':u.path])));
      setPreview(null);
    }catch(e){setMessage(e.message);}
  }

  async function submit(){
    if(!session||submitting)return;
    setSubmitting(true);
    try{
      const data=await request('/api/sessions/'+session.id+'/submit',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
        units:units.map(u=>({unit_id_ref:u.id,typed_code:typed[u.id]||'',typed_path:paths[u.id]||''}))
      })});
      localStorage.removeItem('interviewdrill:'+session.id);setReport(data);setSession({...session,status:'submitted'});
    }catch(e){setMessage(e.message);setSubmitting(false);}
  }

  useEffect(()=>{if(session&&left===0&&session.status==='in_progress'&&!submitting)submit();},[left,session,submitting]);

  if(report)return <section>
    <h2 className="text-4xl font-black">Evaluation Report</h2>
    <div className="mt-6 grid gap-4 md:grid-cols-4">
      {[['Accuracy',Number(report.overall_accuracy).toFixed(1)+'%'],['Completion',Number(report.completion_pct).toFixed(1)+'%'],['Structure',Number(report.structure_score).toFixed(1)+'%'],['WPM',Number(report.avg_wpm).toFixed(1)]].map(([l,v])=><div className="card" key={l}><div className="text-xs uppercase text-zinc-500">{l}</div><div className="mt-2 text-3xl font-black">{v}</div></div>)}
    </div>
    <div className="card mt-5">{report.summary_text}</div>
    <div className="card mt-5 overflow-auto"><table className="w-full text-left text-sm"><thead><tr className="text-zinc-500"><th className="p-2">Unit</th><th>Accuracy</th><th>WPM</th><th>Structure</th><th>Mistakes</th></tr></thead><tbody>{report.results.map(r=><tr className="border-t border-zinc-800" key={r.id}><td className="p-2 font-mono">{r.label}</td><td>{Number(r.char_accuracy).toFixed(1)}%</td><td>{Number(r.wpm).toFixed(1)}</td><td>{r.correct_path?'✓':'✕'}</td><td>{(r.mistakes_json||[]).join(', ')||'—'}</td></tr>)}</tbody></table></div>
    <button className="btn mt-5" onClick={()=>{setReport(null);setSession(null);}}>Back to library</button>
  </section>;

  if(session&&active){
    const elapsed=Math.max(1,Math.floor((Date.now()-new Date(session.started_at).getTime())/1000));
    const live=textMetrics(typed[active.id]||'',active.reference_code,elapsed);
    return <section>
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <div className="card"><div className="text-xs text-zinc-500">Time left</div><div className={'mt-1 text-2xl font-black '+(left<=session.time_limit_seconds*.1?'text-red-400':left<=session.time_limit_seconds*.25?'text-amber-400':'')}>{fmt(left)}</div></div>
        <div className="card"><div className="text-xs text-zinc-500">Unit</div><div className="mt-1 font-bold">{units.findIndex(u=>u.id===active.id)+1}/{units.length}</div></div>
        <div className="card"><div className="text-xs text-zinc-500">Live WPM</div><div className="mt-1 text-2xl font-black">{live.wpm}</div></div>
        <div className="card"><div className="text-xs text-zinc-500">Live accuracy</div><div className="mt-1 text-2xl font-black">{live.accuracy}%</div></div>
      </div>
      {session.recall&&<div className="card mb-4 text-sm"><b>Recall mode:</b> <span className="text-zinc-400">{hidden?'reference hidden — type from memory':'memorize the reference before it hides'}</span></div>}
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="card h-fit"><b>{mode==='lld'?'Classes':'Files'}</b><div className="mt-3 space-y-1">{units.map(u=><button onClick={()=>setActiveId(u.id)} key={u.id} className={'block w-full rounded-lg p-2 text-left text-xs '+(u.id===active.id?'bg-zinc-700':'bg-zinc-950')}>{u.name||u.path}{u.pattern_tag&&u.pattern_tag!=='none'&&<span className="block text-zinc-500">{u.pattern_tag}</span>}</button>)}</div></aside>
        <div>
          {mode==='machine_coding'&&<input className="input mb-3 font-mono text-sm" placeholder="Type exact file path from memory" value={paths[active.id]||''} onChange={e=>setPaths({...paths,[active.id]:e.target.value})}/>}
          {hidden?<CodeEditor value={typed[active.id]||''} onChange={v=>setTyped({...typed,[active.id]:v})} language={active.language}/>:<CodeDiff reference={active.reference_code} value={typed[active.id]||''} onChange={v=>setTyped({...typed,[active.id]:v})} language={active.language}/>}
        </div>
      </div>
      <button className="btn mt-4" onClick={submit} disabled={submitting}>{submitting?'Submitting…':'Submit round'}</button>
      {message&&<div className="card mt-4 text-sm">{message}</div>}
    </section>;
  }

  if(preview)return <section>
    <button className="btn2 mb-4" onClick={()=>setPreview(null)}>← Back</button>
    <div className="card"><div className="text-xs uppercase text-zinc-500">{preview.difficulty} · {preview.estimated_minutes} min</div><h2 className="mt-2 text-4xl font-black">{preview.title}</h2><p className="mt-3 max-w-3xl text-zinc-400">{preview.description}</p></div>
    <div className="card mt-5"><h3 className="font-bold">{mode==='lld'?'Class plan':'Target structure'}</h3><div className="mt-3 grid gap-2">{preview.units.map(u=><div className="rounded-lg bg-zinc-950 p-3 text-sm" key={u.id}><span className="font-mono">{u.name||u.path}</span>{mode==='lld'&&<span className="ml-3 text-zinc-500">{u.pattern_tag}</span>}</div>)}</div></div>
    <div className="card mt-5 flex flex-wrap items-center gap-5"><label className="flex items-center gap-2"><input type="checkbox" checked={recall} onChange={e=>setRecall(e.target.checked)}/> Recall mode</label>{recall&&<label>Preview <input className="ml-2 w-20 rounded-lg bg-zinc-950 p-2" type="number" min="5" max="60" value={previewSeconds} onChange={e=>setPreviewSeconds(+e.target.value)}/> sec</label>}</div>
    <button className="btn mt-5" onClick={start}>Start timed round</button>
  </section>;

  return <section>
    <div className="flex flex-wrap gap-2">{Object.entries(titles).map(([k,v])=><button className={k===mode?'btn':'btn2'} key={k} onClick={()=>setMode(k)}>{v}</button>)}</div>
    <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{projects.map(p=><button onClick={()=>openProject(p)} className="card text-left hover:border-zinc-600" key={p.id}><div className="text-xs uppercase text-zinc-500">{p.difficulty} · {p.estimated_minutes} min</div><h3 className="mt-2 text-xl font-bold">{p.title}</h3><p className="mt-2 text-sm text-zinc-400">{p.description}</p><div className="mt-3 flex flex-wrap gap-1">{(p.tags||[]).map(t=><span className="rounded-full bg-zinc-800 px-2 py-1 text-xs" key={t}>{t}</span>)}</div></button>)}</div>
    {message&&<div className="card mt-5 text-sm">{message}</div>}
  </section>;
}

function Admin(){
  const[pin,setPin]=useState('');
  const[ok,setOk]=useState(false);
  const[msg,setMsg]=useState('');
  const[form,setForm]=useState({title:'',description:'',category:'machine_coding',difficulty:'beginner',estimated_minutes:45,tags:'express',name:'src/index.js',language:'javascript',reference_code:'',pattern_tag:'none'});
  const[zip,setZip]=useState(null);

  async function verify(){try{await request('/api/admin/verify',{method:'POST',headers:{'x-admin-pin':pin}});setOk(true);setMsg('');}catch(e){setMsg(e.message);}}
  async function create(){
    try{
      const unit=form.category==='lld'?{kind:'class',name:form.name,path:form.name,reference_code:form.reference_code,language:'cpp',pattern_tag:form.pattern_tag}:{kind:'file',name:form.name.split('/').at(-1),path:form.name,reference_code:form.reference_code,language:form.language};
      const data=await request('/api/admin/content',{method:'POST',headers:{'content-type':'application/json','x-admin-pin':pin},body:JSON.stringify({...form,tags:form.tags.split(',').map(x=>x.trim()).filter(Boolean),units:[unit]})});
      setMsg('Created '+data.title);
    }catch(e){setMsg(e.message);}
  }
  async function upload(){
    if(!zip)return setMsg('Choose a ZIP first');
    const fd=new FormData();fd.append('archive',zip);fd.append('title',form.title||zip.name.replace(/\.zip$/i,''));fd.append('description',form.description);fd.append('difficulty',form.difficulty);fd.append('estimated_minutes',form.estimated_minutes);
    try{const data=await request('/api/admin/upload',{method:'POST',headers:{'x-admin-pin':pin},body:fd});setMsg('Imported '+data.files_imported+' files into '+data.project.title);}catch(e){setMsg(e.message);}
  }

  if(!ok)return <section className="mx-auto max-w-md"><div className="card"><h2 className="text-2xl font-black">Admin PIN</h2><input className="input mt-4" type="password" value={pin} onChange={e=>setPin(e.target.value)}/><button className="btn mt-3" onClick={verify}>Unlock</button>{msg&&<p className="mt-3 text-sm">{msg}</p>}</div></section>;
  return <section><h2 className="text-4xl font-black">Content Admin</h2><div className="mt-6 grid gap-5 lg:grid-cols-2">
    <div className="card"><h3 className="font-bold">Manual entry</h3><div className="mt-4 grid gap-3">
      <input className="input" placeholder="Title" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/>
      <textarea className="input" placeholder="Description" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/>
      <div className="grid grid-cols-2 gap-3"><select className="input" value={form.category} onChange={e=>setForm({...form,category:e.target.value})}><option value="snippet">Snippet</option><option value="machine_coding">Machine Coding</option><option value="lld">LLD</option></select><select className="input" value={form.difficulty} onChange={e=>setForm({...form,difficulty:e.target.value})}><option>beginner</option><option>intermediate</option><option>advanced</option></select></div>
      <input className="input" type="number" value={form.estimated_minutes} onChange={e=>setForm({...form,estimated_minutes:e.target.value})}/>
      <input className="input" placeholder="Tags comma separated" value={form.tags} onChange={e=>setForm({...form,tags:e.target.value})}/>
      <input className="input font-mono" placeholder={form.category==='lld'?'Class name':'File path'} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
      {form.category==='lld'&&<input className="input" placeholder="Pattern tag" value={form.pattern_tag} onChange={e=>setForm({...form,pattern_tag:e.target.value})}/>}
      <textarea className="input min-h-80 font-mono text-sm" placeholder="Reference code" value={form.reference_code} onChange={e=>setForm({...form,reference_code:e.target.value})}/>
      <button className="btn" onClick={create}>Create content</button>
    </div></div>
    <div className="card h-fit"><h3 className="font-bold">ZIP import</h3><p className="mt-2 text-sm text-zinc-500">Import up to 100 files / 5 MB into a machine-coding project.</p><input className="mt-4 block w-full text-sm" type="file" accept=".zip" onChange={e=>setZip(e.target.files?.[0]||null)}/><button className="btn mt-4" onClick={upload}>Import ZIP</button></div>
  </div>{msg&&<div className="card mt-5">{msg}</div>}</section>;
}

export default function AppShell({user}){
  const[page,setPage]=useState('dashboard');
  const[practiceMode,setPracticeMode]=useState('snippet');
  function goPractice(mode){setPracticeMode(mode);setPage('practice');}
  async function signOut(){await fetch('/api/auth/logout',{method:'POST'});window.location.href='/login';}

  return <main className="mx-auto max-w-7xl p-5">
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-5">
      <div><div className="text-xs uppercase tracking-[.2em] text-zinc-500">Vercel edition</div><h1 className="mt-1 text-3xl font-black">InterviewDrill</h1></div>
      <div className="flex flex-wrap gap-2"><nav className="flex gap-2">{['dashboard','practice','admin'].map(x=><button key={x} className={page===x?'btn':'btn2'} onClick={()=>setPage(x)}>{x[0].toUpperCase()+x.slice(1)}</button>)}</nav><button className="btn2" onClick={signOut}>Logout</button></div>
    </header>
    {page==='dashboard'&&<Dashboard goPractice={goPractice}/>}
    {page==='practice'&&<Practice key={practiceMode} initialMode={practiceMode}/>}
    {page==='admin'&&<Admin/>}
  </main>;
}
