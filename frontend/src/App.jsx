import { useEffect,useMemo,useState } from 'react';
import { api,bootstrapAuth,login,logout } from './api.js';

function formatTime(total){
  const seconds=Math.max(0,total);
  return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
}

const modeTitle={snippet:'Snippet Drills',machine_coding:'Machine Coding',lld:'LLD Practice'};

function Login({onLoggedIn}){
  const[username,setUsername]=useState('akash');
  const[password,setPassword]=useState('');
  const[error,setError]=useState('');

  async function submit(event){
    event.preventDefault();
    try{
      const user=await login(username,password);
      onLoggedIn(user);
    }catch(err){setError(err.message);}
  }

  return <main className="mx-auto flex min-h-screen max-w-md items-center p-6">
    <form className="card w-full" onSubmit={submit}>
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Self-hosted</p>
      <h1 className="mt-2 text-3xl font-black">InterviewDrill</h1>
      <p className="mt-2 text-sm text-zinc-400">Sign in with the credentials configured on your Gateway.</p>
      <input className="mt-5 w-full rounded-xl bg-zinc-950 p-3" value={username} onChange={e=>setUsername(e.target.value)} placeholder="Username"/>
      <input className="mt-3 w-full rounded-xl bg-zinc-950 p-3" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password"/>
      <button className="btn mt-4 w-full" type="submit">Sign in</button>
      {error&&<p className="mt-3 text-sm text-red-300">{error}</p>}
    </form>
  </main>;
}

function Dashboard({onPractice}){
  const[data,setData]=useState({stats:[],mistakes:[],events:[]});
  const[content,setContent]=useState([]);
  const[message,setMessage]=useState('');

  useEffect(()=>{
    Promise.all([api('/progress/dashboard'),api('/content/projects')])
      .then(([progress,projects])=>{setData(progress);setContent(projects);})
      .catch(error=>setMessage(error.message));
  },[]);

  const topMistakes=data.mistakes.slice(0,5);
  const focus=useMemo(()=>{
    const keys=topMistakes.map(x=>x.pattern_key.toLowerCase().replace('pattern:',''));
    return content.filter(project=>{
      const hay=(project.tags||[]).join(' ').toLowerCase();
      return keys.some(key=>
        hay.includes(key)||
        (key==='missing_async'&&hay.includes('express'))||
        (key==='missing_error_propagation'&&hay.includes('error'))
      );
    }).slice(0,6);
  },[content,topMistakes]);

  return <section>
    <div className="flex items-end justify-between gap-4">
      <div><p className="text-sm uppercase tracking-[0.2em] text-zinc-500">Progress</p><h1 className="mt-2 text-4xl font-black">Dashboard</h1></div>
      <button className="btn" onClick={()=>onPractice('snippet')}>Start a drill</button>
    </div>

    <div className="mt-6 grid gap-4 md:grid-cols-3">
      {data.stats.length?data.stats.map(stat=><div className="card" key={stat.category}>
        <div className="text-xs uppercase text-zinc-500">{modeTitle[stat.category]||stat.category}</div>
        <div className="mt-2 text-3xl font-black">{Number(stat.avg_accuracy).toFixed(1)}%</div>
        <div className="mt-2 text-sm text-zinc-400">{Number(stat.avg_wpm).toFixed(1)} WPM · {stat.sessions_completed} sessions</div>
      </div>):<div className="card text-zinc-400">Complete a session to populate progress.</div>}
    </div>

    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <div className="card">
        <h2 className="text-lg font-bold">Recent accuracy trend</h2>
        <div className="mt-5 space-y-3">
          {data.events.length?data.events.map((event,index)=><div key={event.session_id}>
            <div className="mb-1 flex justify-between text-xs text-zinc-500">
              <span>#{index+1} · {event.category}</span><span>{Number(event.accuracy).toFixed(1)}%</span>
            </div>
            <div className="h-2 rounded bg-zinc-800"><div className="h-2 rounded bg-zinc-200" style={{width:Math.min(100,Number(event.accuracy))+'%'}}/></div>
          </div>):<p className="text-sm text-zinc-500">No evaluated sessions yet.</p>}
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-bold">Mistake pattern log</h2>
        <div className="mt-4 space-y-2">
          {topMistakes.length?topMistakes.map(item=><div className="flex justify-between rounded-xl bg-zinc-950 p-3 text-sm" key={item.id}>
            <span className="font-mono">{item.pattern_key}</span><span className="text-zinc-500">×{item.occurrence_count}</span>
          </div>):<p className="text-sm text-zinc-500">Mistakes will appear after evaluations.</p>}
        </div>
      </div>
    </div>

    <div className="card mt-6">
      <h2 className="text-lg font-bold">Focus Drill</h2>
      <p className="mt-1 text-sm text-zinc-500">Content matched against your most frequent mistake tags.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {focus.length?focus.map(project=><button className="rounded-xl border border-zinc-800 p-4 text-left hover:border-zinc-600" key={project.id} onClick={()=>onPractice(project.category)}>
          <div className="text-xs text-zinc-500">{project.category}</div>
          <div className="mt-1 font-bold">{project.title}</div>
          <div className="mt-2 text-xs text-zinc-500">{(project.tags||[]).join(' · ')}</div>
        </button>):<p className="text-sm text-zinc-500">No matching focus content yet.</p>}
      </div>
    </div>
    {message&&<div className="card mt-5">{message}</div>}
  </section>;
}

function Admin(){
  const[pin,setPin]=useState('');
  const[verified,setVerified]=useState(false);
  const[message,setMessage]=useState('');
  const[form,setForm]=useState({
    title:'',description:'',category:'machine_coding',difficulty:'beginner',estimated_minutes:45,tags:'express',
    path:'src/index.js',language:'javascript',reference_code:''
  });
  const[zip,setZip]=useState(null);

  async function verify(){
    try{await api('/admin/verify',{method:'POST',headers:{'x-admin-pin':pin}});setVerified(true);setMessage('');}
    catch(error){setMessage(error.message);}
  }

  async function createManual(){
    try{
      if(!form.title.trim()||!form.reference_code.trim())throw new Error('Title and reference code are required');
      const payload={
        title:form.title,description:form.description,category:form.category,difficulty:form.difficulty,
        estimated_minutes:Number(form.estimated_minutes),
        tags:form.tags.split(',').map(x=>x.trim()).filter(Boolean),
        files:form.category==='lld'?[]:[{path:form.path,language:form.language,reference_code:form.reference_code,order_index:1}],
        lld_classes:form.category==='lld'?[{name:form.path||'ClassName',reference_code:form.reference_code,pattern_tag:form.tags.split(',')[0]||'none',order_index:1}]:[]
      };
      const result=await api('/admin/projects',{method:'POST',headers:{'x-admin-pin':pin},body:JSON.stringify(payload)});
      setMessage('Created: '+result.title);
    }catch(error){setMessage(error.message);}
  }

  async function uploadZip(){
    if(!zip)return setMessage('Choose a ZIP archive first.');
    const data=new FormData();
    data.append('archive',zip);
    data.append('title',form.title||zip.name.replace(/\.zip$/i,''));
    data.append('description',form.description);
    data.append('category',form.category==='lld'?'machine_coding':form.category);
    data.append('difficulty',form.difficulty);
    data.append('estimated_minutes',String(form.estimated_minutes));
    try{
      const result=await api('/admin/upload-zip',{method:'POST',headers:{'x-admin-pin':pin},body:data});
      setMessage(`Imported ${result.files_imported} files into ${result.project.title}`);
    }catch(error){setMessage(error.message);}
  }

  if(!verified)return <section className="mx-auto max-w-md">
    <div className="card">
      <h1 className="text-2xl font-black">Admin</h1>
      <p className="mt-2 text-sm text-zinc-500">Enter the server-side Admin PIN.</p>
      <input className="mt-4 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3" type="password" value={pin} onChange={e=>setPin(e.target.value)}/>
      <button className="btn mt-3" onClick={verify}>Unlock</button>
      {message&&<p className="mt-3 text-sm">{message}</p>}
    </div>
  </section>;

  return <section>
    <h1 className="text-4xl font-black">Content Admin</h1>
    <p className="mt-2 text-zinc-400">Create content manually or import an existing project ZIP.</p>
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <div className="card">
        <h2 className="text-lg font-bold">Manual entry</h2>
        <div className="mt-4 grid gap-3">
          <input className="rounded-xl bg-zinc-950 p-3" placeholder="Title" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/>
          <textarea className="rounded-xl bg-zinc-950 p-3" placeholder="Description" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/>
          <div className="grid grid-cols-2 gap-3">
            <select className="rounded-xl bg-zinc-950 p-3" value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>
              <option value="snippet">Snippet</option><option value="machine_coding">Machine Coding</option><option value="lld">LLD</option>
            </select>
            <select className="rounded-xl bg-zinc-950 p-3" value={form.difficulty} onChange={e=>setForm({...form,difficulty:e.target.value})}>
              <option>beginner</option><option>intermediate</option><option>advanced</option>
            </select>
          </div>
          <input className="rounded-xl bg-zinc-950 p-3" type="number" value={form.estimated_minutes} onChange={e=>setForm({...form,estimated_minutes:e.target.value})}/>
          <input className="rounded-xl bg-zinc-950 p-3" placeholder="Tags, comma separated" value={form.tags} onChange={e=>setForm({...form,tags:e.target.value})}/>
          <input className="rounded-xl bg-zinc-950 p-3 font-mono" placeholder={form.category==='lld'?'Class name':'File path'} value={form.path} onChange={e=>setForm({...form,path:e.target.value})}/>
          <select className="rounded-xl bg-zinc-950 p-3" value={form.language} onChange={e=>setForm({...form,language:e.target.value})}>
            <option value="javascript">JavaScript</option><option value="python">Python</option><option value="cpp">C++</option>
          </select>
          <textarea className="min-h-72 rounded-xl bg-zinc-950 p-3 font-mono text-sm" placeholder="Reference code" value={form.reference_code} onChange={e=>setForm({...form,reference_code:e.target.value})}/>
          <button className="btn" onClick={createManual}>Create content</button>
        </div>
      </div>
      <div className="card h-fit">
        <h2 className="text-lg font-bold">ZIP import</h2>
        <p className="mt-2 text-sm text-zinc-500">Imports files, preserves paths, and derives basic tags.</p>
        <input className="mt-4 block w-full text-sm" type="file" accept=".zip,application/zip" onChange={e=>setZip(e.target.files?.[0]||null)}/>
        <button className="btn mt-4" onClick={uploadZip}>Import ZIP</button>
      </div>
    </div>
    {message&&<div className="card mt-5">{message}</div>}
  </section>;
}

function Practice({initialMode='snippet'}){
  const[mode,setMode]=useState(initialMode);
  const[projects,setProjects]=useState([]);
  const[project,setProject]=useState(null);
  const[preview,setPreview]=useState(null);
  const[session,setSession]=useState(null);
  const[typed,setTyped]=useState({});
  const[paths,setPaths]=useState({});
  const[activeId,setActiveId]=useState(null);
  const[left,setLeft]=useState(0);
  const[message,setMessage]=useState('');
  const[submitted,setSubmitted]=useState(false);
  const[report,setReport]=useState(null);
  const[recall,setRecall]=useState(false);
  const[previewSeconds,setPreviewSeconds]=useState(10);
  const[referenceHidden,setReferenceHidden]=useState(false);

  useEffect(()=>{
    setPreview(null);setProject(null);setSession(null);setReport(null);setReferenceHidden(false);
    api('/content/projects?category='+mode).then(setProjects).catch(error=>setMessage(error.message));
  },[mode]);

  useEffect(()=>{
    if(!session||session.status!=='in_progress')return;
    const tick=()=>{
      const started=new Date(session.started_at).getTime();
      setLeft(Math.max(0,session.time_limit_seconds-Math.floor((Date.now()-started)/1000)));
      if(session.recall){
        setReferenceHidden(Date.now()-started>=session.recall_preview_seconds*1000);
      }
    };
    tick();
    const id=setInterval(tick,500);
    return()=>clearInterval(id);
  },[session]);

  const units=session?.reference_snapshot?.units||session?.reference_snapshot?.files||[];
  const active=useMemo(()=>units.find(unit=>unit.id===activeId)||units[0]||null,[units,activeId]);

  async function openProject(selected){
    try{
      const full=await api('/content/projects/'+selected.id);
      if(mode==='lld')setPreview(full);else await start(full);
    }catch(error){setMessage(error.message);}
  }

  async function start(full){
    try{
      setProject(full);setPreview(null);setMessage('');setReferenceHidden(false);
      const created=await api('/sessions',{method:'POST',body:JSON.stringify({
        project_id:full.id,
        time_limit_seconds:full.estimated_minutes*60,
        recall,
        recall_preview_seconds:previewSeconds
      })});
      const createdUnits=created.reference_snapshot.units||created.reference_snapshot.files||[];
      setSession(created);setLeft(created.time_limit_seconds);setTyped({});
      setPaths(Object.fromEntries(createdUnits.map(unit=>[unit.id,mode==='machine_coding'?'':(unit.path||unit.name||'')])));
      setActiveId(createdUnits[0]?.id||null);setSubmitted(false);setReport(null);
    }catch(error){setMessage(error.message);}
  }

  async function submit(){
    if(!session||submitted)return;
    try{
      setSubmitted(true);
      const result=await api('/sessions/'+session.id+'/submit',{method:'POST',body:JSON.stringify({
        files:units.map(unit=>({file_id_ref:unit.id,typed_code:typed[unit.id]||'',typed_path:paths[unit.id]||unit.path||unit.name||''}))
      })});
      setSession(result);setMessage('Submitted. Evaluation is running asynchronously…');
      for(let attempt=0;attempt<30;attempt++){
        try{const next=await api('/evaluations/session/'+result.id);setReport(next);setMessage('');return;}
        catch(error){if(!String(error.message).includes('Report not ready'))throw error;}
        await new Promise(resolve=>setTimeout(resolve,1000));
      }
      setMessage('Evaluation is still processing.');
    }catch(error){setSubmitted(false);setMessage(error.message);}
  }

  useEffect(()=>{if(left===0&&session?.status==='in_progress'&&!submitted)submit();},[left,session?.status,submitted]);

  const setupControls=<div className="card mt-5 flex flex-wrap items-center gap-5">
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={recall} onChange={e=>setRecall(e.target.checked)}/>
      Recall mode
    </label>
    {recall&&<label className="text-sm">Preview
      <input className="ml-3 w-20 rounded-lg bg-zinc-950 p-2" type="number" min="5" max="60" value={previewSeconds} onChange={e=>setPreviewSeconds(Math.min(60,Math.max(5,Number(e.target.value)||10)))}/>
      <span className="ml-2 text-zinc-500">seconds</span>
    </label>}
  </div>;

  if(preview&&mode==='lld')return <section>
    <button className="mb-5 text-sm text-zinc-400" onClick={()=>setPreview(null)}>← Back</button>
    <div className="card"><h1 className="text-4xl font-black">{preview.title}</h1><p className="mt-4 text-zinc-300">{preview.description}</p></div>
    <div className="mt-5 grid gap-3 md:grid-cols-2">{preview.lld_classes.map(c=><div className="card" key={c.id}><div className="text-xs uppercase text-zinc-500">{c.pattern_tag}</div><b className="mt-2 block text-xl">{c.name}</b></div>)}</div>
    {setupControls}
    <button className="btn mt-5" onClick={()=>start(preview)}>Start timed session</button>
  </section>;

  if(report){
    const isLld=project?.category==='lld';
    return <section>
      <h1 className="text-4xl font-black">{project?.title} Report</h1>
      <div className="mt-6 grid gap-4 md:grid-cols-4">{[
        ['Accuracy',report.overall_accuracy+'%'],['Completion',report.completion_pct+'%'],['Structure',report.structure_score+'%'],['Time',report.time_used_seconds+'s']
      ].map(([l,v])=><div className="card" key={l}><div className="text-xs uppercase text-zinc-500">{l}</div><div className="mt-2 text-3xl font-black">{v}</div></div>)}</div>
      <div className="card mt-5">{report.summary_text}</div>
      <div className="card mt-5 overflow-auto"><table className="w-full text-left text-sm"><thead><tr className="text-zinc-500"><th className="p-2">{isLld?'Class':'File'}</th>{isLld&&<th>Pattern</th>}<th>Accuracy</th>{!isLld&&<th>Path</th>}<th>Mistakes</th></tr></thead><tbody>
        {report.files.map(r=>{const ref=units.find(u=>u.id===r.file_id_ref);return <tr className="border-t border-zinc-800" key={r.id}><td className="p-2">{ref?.name||ref?.path}</td>{isLld&&<td>{ref?.pattern_tag}</td>}<td>{r.char_accuracy}%</td>{!isLld&&<td>{r.correct_path?'Correct':'Wrong'}</td>}<td>{(r.mistakes_json||[]).filter(x=>!String(x).startsWith('pattern:')).join(', ')||'—'}</td></tr>})}
      </tbody></table></div>
      <button className="btn mt-5" onClick={()=>{setSession(null);setProject(null);setReport(null);}}>Back to library</button>
    </section>;
  }

  return <section>
    <div className="flex flex-wrap gap-2">{Object.entries(modeTitle).map(([key,label])=><button key={key} className={`rounded-xl px-4 py-2 ${mode===key?'bg-white text-black':'border border-zinc-700'}`} onClick={()=>setMode(key)}>{label}</button>)}</div>

    {!session&&<>
      {setupControls}
      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{projects.map(item=><article className="card" key={item.id}><div className="text-xs text-zinc-500">{item.difficulty} · {item.estimated_minutes} min</div><h3 className="mt-2 text-xl font-bold">{item.title}</h3><p className="mt-2 text-sm text-zinc-400">{item.description}</p><button className="btn mt-4" onClick={()=>openProject(item)}>{mode==='lld'?'View problem':'Start'}</button></article>)}</div>
    </>}

    {session&&active&&<div className="mt-6">
      {session.recall&&<div className="card mb-4 text-sm">
        <b>Recall mode</b>
        <span className="ml-2 text-zinc-400">{referenceHidden?'Reference hidden — continue from memory.':`Memorize now. Hides after ${session.recall_preview_seconds}s.`}</span>
      </div>}
      {mode==='machine_coding'&&<div className="card mb-4"><b>Target structure</b><pre className="mt-3 text-sm text-zinc-400">{project?.files?.map(f=>f.path).join('\n')}</pre></div>}
      <div className="mb-4 flex justify-between"><div><div className="text-sm text-zinc-500">{active.pattern_tag||project?.title}</div><h2 className="text-xl font-bold">{active.name||active.path}</h2></div><div className="rounded-xl border border-zinc-800 px-4 py-2 font-mono text-xl">{formatTime(left)}</div></div>
      <div className="grid gap-4 lg:grid-cols-[250px_1fr]">
        <aside className="card h-fit">{units.map(unit=><button className="mb-2 block w-full rounded-lg bg-zinc-950 p-2 text-left text-xs" key={unit.id} onClick={()=>setActiveId(unit.id)}>{unit.name||unit.path}</button>)}</aside>
        <div>
          {mode==='machine_coding'&&<input className="mb-3 w-full rounded-xl bg-zinc-950 p-3 font-mono text-sm" placeholder="Type file path from memory" value={paths[active.id]||''} onChange={e=>setPaths({...paths,[active.id]:e.target.value})}/>}
          <div className={referenceHidden?'grid gap-4':'grid gap-4 xl:grid-cols-2'}>
            {!referenceHidden&&<div className="card"><div className="mb-2 text-sm text-zinc-500">Reference</div><pre className="max-h-[560px] overflow-auto whitespace-pre-wrap font-mono text-xs">{active.reference_code}</pre></div>}
            <div className="card"><div className="mb-2 text-sm text-zinc-500">Your code</div><textarea className="min-h-[560px] w-full bg-zinc-950 p-3 font-mono text-xs" value={typed[active.id]||''} onChange={e=>setTyped({...typed,[active.id]:e.target.value})} disabled={submitted}/></div>
          </div>
        </div>
      </div>
      <button className="btn mt-4" onClick={submit} disabled={submitted}>Submit round</button>
    </div>}
    {message&&<div className="card mt-5">{message}</div>}
  </section>;
}

export default function App(){
  const[authReady,setAuthReady]=useState(false);
  const[user,setUser]=useState(null);
  const[page,setPage]=useState('dashboard');
  const[practiceMode,setPracticeMode]=useState('snippet');

  useEffect(()=>{
    bootstrapAuth().then(ok=>{setAuthReady(true);if(ok)setUser({username:'session'});});
  },[]);

  async function signOut(){
    await logout();
    setUser(null);
  }

  function goPractice(mode='snippet'){setPracticeMode(mode);setPage('practice');}

  if(!authReady)return <main className="p-6 text-zinc-400">Loading InterviewDrill…</main>;
  if(!user)return <Login onLoggedIn={setUser}/>;

  return <main className="mx-auto max-w-7xl p-6">
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <div><p className="text-sm uppercase tracking-[0.2em] text-zinc-500">Interview practice platform</p><h1 className="mt-1 text-3xl font-black">InterviewDrill</h1></div>
      <div className="flex flex-wrap gap-2">
        <nav className="flex gap-2">
          {['dashboard','practice','admin'].map(item=><button key={item} onClick={()=>setPage(item)} className={`rounded-xl px-4 py-2 capitalize ${page===item?'bg-white text-black':'border border-zinc-700'}`}>{item}</button>)}
        </nav>
        <button className="rounded-xl border border-zinc-700 px-4 py-2" onClick={signOut}>Logout</button>
      </div>
    </header>
    {page==='dashboard'&&<Dashboard onPractice={goPractice}/>}
    {page==='practice'&&<Practice key={practiceMode} initialMode={practiceMode}/>}
    {page==='admin'&&<Admin/>}
  </main>;
}
