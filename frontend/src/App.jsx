import { useEffect, useMemo, useState } from 'react';
import { api } from './api.js';

function formatTime(total) {
  const seconds = Math.max(0, total);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function App() {
  const [mode, setMode] = useState('snippet');
  const [projects, setProjects] = useState([]);
  const [project, setProject] = useState(null);
  const [session, setSession] = useState(null);
  const [typed, setTyped] = useState({});
  const [paths, setPaths] = useState({});
  const [activeId, setActiveId] = useState(null);
  const [left, setLeft] = useState(0);
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [report, setReport] = useState(null);

  useEffect(() => {
    api('/content/projects?category=' + mode)
      .then(setProjects)
      .catch(error => setMessage(error.message));
  }, [mode]);

  useEffect(() => {
    if (!session || session.status !== 'in_progress') return;
    const tick = () => {
      const started = new Date(session.started_at).getTime();
      const elapsed = Math.floor((Date.now() - started) / 1000);
      setLeft(Math.max(0, session.time_limit_seconds - elapsed));
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [session]);

  const files = session?.reference_snapshot?.files || [];
  const active = useMemo(() => files.find(file => file.id === activeId) || files[0] || null, [files, activeId]);

  async function start(selected) {
    try {
      setMessage('');
      const full = await api('/content/projects/' + selected.id);
      setProject(full);
      const created = await api('/sessions', {
        method: 'POST',
        body: JSON.stringify({ project_id: selected.id, time_limit_seconds: selected.estimated_minutes * 60 })
      });
      setSession(created);
      const initialPaths = Object.fromEntries(created.reference_snapshot.files.map(file => [file.id, mode === 'snippet' ? file.path : '']));
      setPaths(initialPaths);
      setTyped({});
      setActiveId(created.reference_snapshot.files[0]?.id || null);
      setSubmitted(false);
      setReport(null);
    } catch (error) { setMessage(error.message); }
  }

  async function submit() {
    if (!session || submitted) return;
    try {
      setSubmitted(true);
      const result = await api('/sessions/' + session.id + '/submit', {
        method: 'POST',
        body: JSON.stringify({
          files: files.map(file => ({
            file_id_ref: file.id,
            typed_code: typed[file.id] || '',
            typed_path: paths[file.id] || ''
          }))
        })
      });
      setSession(result);
      setMessage('Submitted. Evaluation is running asynchronously…');
      pollReport(result.id);
    } catch (error) {
      setSubmitted(false);
      setMessage(error.message);
    }
  }

  async function pollReport(sessionId) {
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        const result = await api('/evaluations/session/' + sessionId);
        setReport(result);
        setMessage('');
        return;
      } catch (error) {
        if (!String(error.message).includes('Report not ready')) {
          setMessage(error.message);
          return;
        }
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    setMessage('Evaluation is still processing. Refresh and retry shortly.');
  }

  useEffect(() => {
    if (left === 0 && session?.status === 'in_progress' && !submitted) submit();
  }, [left, session?.status, submitted]);

  if (report) return <main className="mx-auto max-w-6xl p-6">
    <h1 className="text-4xl font-black">Evaluation Report</h1>
    <p className="mt-2 text-zinc-400">{project?.title}</p>
    <div className="mt-6 grid gap-4 md:grid-cols-4">
      {[['Accuracy',report.overall_accuracy + '%'],['Completion',report.completion_pct + '%'],['Structure',report.structure_score + '%'],['Time',report.time_used_seconds + 's']].map(([label,value]) =>
        <div className="card" key={label}><div className="text-xs uppercase text-zinc-500">{label}</div><div className="mt-2 text-3xl font-black">{value}</div></div>
      )}
    </div>
    <div className="card mt-6"><b>Summary</b><p className="mt-2 text-zinc-300">{report.summary_text}</p></div>
    <div className="card mt-6 overflow-auto">
      <table className="w-full text-left text-sm">
        <thead><tr className="text-zinc-500"><th className="p-2">File</th><th>Accuracy</th><th>Path</th><th>Mistakes</th></tr></thead>
        <tbody>{report.files.map(result => {
          const ref = files.find(file => file.id === result.file_id_ref);
          return <tr className="border-t border-zinc-800" key={result.id}>
            <td className="p-2 font-mono">{ref?.path}</td><td>{result.char_accuracy}%</td>
            <td>{result.correct_path ? 'Correct' : 'Wrong'}</td>
            <td>{(result.mistakes_json || []).join(', ') || '—'}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
    <button className="btn mt-5" onClick={() => { setSession(null); setProject(null); setReport(null); setMessage(''); }}>Back to library</button>
  </main>;

  return <main className="mx-auto max-w-7xl p-6">
    <header className="mb-8">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">Phase 1</p>
      <h1 className="mt-2 text-4xl font-black">InterviewDrill</h1>
      <div className="mt-5 flex gap-2">
        <button className={`rounded-xl px-4 py-2 ${mode === 'snippet' ? 'bg-white text-black' : 'border border-zinc-700'}`} onClick={() => { setMode('snippet'); setSession(null); }}>Snippet Drills</button>
        <button className={`rounded-xl px-4 py-2 ${mode === 'machine_coding' ? 'bg-white text-black' : 'border border-zinc-700'}`} onClick={() => { setMode('machine_coding'); setSession(null); }}>Machine Coding</button>
      </div>
    </header>

    {!session && <section>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects.map(item => <article className="card" key={item.id}>
          <div className="mb-3 text-xs text-zinc-400">{item.difficulty} • {item.estimated_minutes} min</div>
          <h3 className="text-xl font-bold">{item.title}</h3>
          <div className="mt-3 flex flex-wrap gap-2">{item.tags.map(tag => <span className="rounded-full bg-zinc-800 px-2 py-1 text-xs" key={tag}>{tag}</span>)}</div>
          <button className="btn mt-5" onClick={() => start(item)}>Start</button>
        </article>)}
      </div>
    </section>}

    {session && active && <section>
      {mode === 'machine_coding' && <div className="card mb-4">
        <b>Target structure</b>
        <pre className="mt-3 text-sm text-zinc-400">{project?.files?.map(file => file.path).join('\n')}</pre>
      </div>}
      <div className="mb-4 flex items-center justify-between">
        <div><p className="text-sm text-zinc-500">{project?.title}</p><h2 className="text-xl font-bold">{active.path}</h2></div>
        <div className="rounded-xl border border-zinc-800 px-4 py-2 font-mono text-xl">{formatTime(left)}</div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="card h-fit">
          <b>Files</b>
          <div className="mt-3 space-y-2">
            {files.map(file => <button className="block w-full rounded-lg bg-zinc-950 p-2 text-left text-xs" key={file.id} onClick={() => setActiveId(file.id)}>{file.path}</button>)}
          </div>
        </aside>
        <div>
          {mode === 'machine_coding' && <input className="mb-3 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 font-mono text-sm" placeholder="Type the file path from memory" value={paths[active.id] || ''} onChange={e => setPaths({ ...paths, [active.id]: e.target.value })}/>}
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="card"><div className="mb-3 text-sm font-semibold text-zinc-400">Reference</div><pre className="max-h-[520px] overflow-auto whitespace-pre-wrap font-mono text-xs">{active.reference_code}</pre></div>
            <div className="card"><div className="mb-3 text-sm font-semibold text-zinc-400">Your code</div><textarea className="min-h-[520px] w-full resize-none rounded-xl bg-zinc-950 p-4 font-mono text-xs outline-none" value={typed[active.id] || ''} disabled={submitted} onChange={e => setTyped({ ...typed, [active.id]: e.target.value })} spellCheck={false}/></div>
          </div>
        </div>
      </div>

      <button className="btn mt-4" disabled={submitted} onClick={submit}>Submit round</button>
    </section>}

    {message && <div className="card mt-5 text-sm">{message}</div>}
  </main>;
}
