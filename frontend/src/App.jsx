import { useEffect, useMemo, useState } from 'react';
import { api } from './api.js';

function formatTime(total) {
  const seconds = Math.max(0, total);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

const modeTitle = {
  snippet: 'Snippet Drills',
  machine_coding: 'Machine Coding',
  lld: 'LLD Practice'
};

export default function App() {
  const [mode, setMode] = useState('snippet');
  const [projects, setProjects] = useState([]);
  const [project, setProject] = useState(null);
  const [preview, setPreview] = useState(null);
  const [session, setSession] = useState(null);
  const [typed, setTyped] = useState({});
  const [paths, setPaths] = useState({});
  const [activeId, setActiveId] = useState(null);
  const [left, setLeft] = useState(0);
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [report, setReport] = useState(null);

  useEffect(() => {
    setPreview(null);
    setProject(null);
    setSession(null);
    setReport(null);
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

  const units = session?.reference_snapshot?.units || session?.reference_snapshot?.files || [];
  const active = useMemo(
    () => units.find(unit => unit.id === activeId) || units[0] || null,
    [units, activeId]
  );

  async function openProject(selected) {
    try {
      setMessage('');
      const full = await api('/content/projects/' + selected.id);
      if (mode === 'lld') {
        setPreview(full);
      } else {
        await start(full);
      }
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function start(full) {
    try {
      setMessage('');
      setProject(full);
      setPreview(null);
      const created = await api('/sessions', {
        method: 'POST',
        body: JSON.stringify({
          project_id: full.id,
          time_limit_seconds: full.estimated_minutes * 60
        })
      });

      const createdUnits = created.reference_snapshot.units || created.reference_snapshot.files || [];
      setSession(created);
      setTyped({});
      setPaths(Object.fromEntries(
        createdUnits.map(unit => [
          unit.id,
          mode === 'machine_coding' ? '' : (unit.path || unit.name || '')
        ])
      ));
      setActiveId(createdUnits[0]?.id || null);
      setSubmitted(false);
      setReport(null);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function submit() {
    if (!session || submitted) return;
    try {
      setSubmitted(true);
      const result = await api('/sessions/' + session.id + '/submit', {
        method: 'POST',
        body: JSON.stringify({
          files: units.map(unit => ({
            file_id_ref: unit.id,
            typed_code: typed[unit.id] || '',
            typed_path: paths[unit.id] || unit.path || unit.name || ''
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
    setMessage('Evaluation is still processing. Retry shortly.');
  }

  useEffect(() => {
    if (left === 0 && session?.status === 'in_progress' && !submitted) submit();
  }, [left, session?.status, submitted]);

  if (preview && mode === 'lld') {
    return <main className="mx-auto max-w-6xl p-6">
      <button className="mb-5 text-sm text-zinc-400" onClick={() => setPreview(null)}>← Back to LLD library</button>
      <div className="card">
        <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
          <span>{preview.difficulty}</span><span>•</span><span>{preview.estimated_minutes} min</span>
        </div>
        <h1 className="mt-3 text-4xl font-black">{preview.title}</h1>
        <p className="mt-4 max-w-3xl leading-7 text-zinc-300">{preview.description}</p>
      </div>

      <section className="mt-6">
        <h2 className="text-xl font-bold">Class plan</h2>
        <p className="mt-1 text-sm text-zinc-500">Study the classes and pattern focus before the timer starts.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {preview.lld_classes.map(item => <div className="card" key={item.id}>
            <div className="text-xs uppercase tracking-wider text-zinc-500">{item.pattern_tag}</div>
            <div className="mt-2 text-xl font-bold">{item.name}</div>
            <div className="mt-3 text-sm text-zinc-400">Reference unit #{item.order_index}</div>
          </div>)}
        </div>
      </section>

      <button className="btn mt-6" onClick={() => start(preview)}>Start timed LLD session</button>
      {message && <div className="card mt-5 text-sm">{message}</div>}
    </main>;
  }

  if (report) {
    const isLld = project?.category === 'lld';
    return <main className="mx-auto max-w-6xl p-6">
      <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">{isLld ? 'LLD evaluation' : 'Evaluation report'}</p>
      <h1 className="mt-2 text-4xl font-black">{project?.title}</h1>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        {[
          ['Accuracy', report.overall_accuracy + '%'],
          ['Completion', report.completion_pct + '%'],
          [isLld ? 'Class structure' : 'Structure', report.structure_score + '%'],
          ['Time', report.time_used_seconds + 's']
        ].map(([label,value]) =>
          <div className="card" key={label}>
            <div className="text-xs uppercase text-zinc-500">{label}</div>
            <div className="mt-2 text-3xl font-black">{value}</div>
          </div>
        )}
      </div>

      <div className="card mt-6">
        <b>Summary</b>
        <p className="mt-2 text-zinc-300">{report.summary_text}</p>
      </div>

      <div className="card mt-6 overflow-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-zinc-500">
              <th className="p-2">{isLld ? 'Class' : 'File'}</th>
              {isLld && <th>Pattern</th>}
              <th>Accuracy</th>
              {!isLld && <th>Path</th>}
              <th>Mistakes</th>
            </tr>
          </thead>
          <tbody>
            {report.files.map(result => {
              const ref = units.find(unit => unit.id === result.file_id_ref);
              return <tr className="border-t border-zinc-800" key={result.id}>
                <td className="p-2 font-mono">{ref?.name || ref?.path}</td>
                {isLld && <td>{ref?.pattern_tag || 'none'}</td>}
                <td>{result.char_accuracy}%</td>
                {!isLld && <td>{result.correct_path ? 'Correct' : 'Wrong'}</td>}
                <td>{(result.mistakes_json || []).filter(x => !String(x).startsWith('pattern:')).join(', ') || '—'}</td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>

      <button className="btn mt-5" onClick={() => {
        setSession(null); setProject(null); setReport(null); setMessage('');
      }}>Back to library</button>
    </main>;
  }

  return <main className="mx-auto max-w-7xl p-6">
    <header className="mb-8">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">Phase 2</p>
      <h1 className="mt-2 text-4xl font-black">InterviewDrill</h1>
      <div className="mt-5 flex flex-wrap gap-2">
        {Object.entries(modeTitle).map(([key,label]) =>
          <button
            key={key}
            className={`rounded-xl px-4 py-2 ${mode === key ? 'bg-white text-black' : 'border border-zinc-700'}`}
            onClick={() => setMode(key)}
          >{label}</button>
        )}
      </div>
    </header>

    {!session && <section>
      <h2 className="mb-4 text-xl font-bold">{modeTitle[mode]}</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects.map(item => <article className="card" key={item.id}>
          <div className="mb-3 text-xs text-zinc-400">{item.difficulty} • {item.estimated_minutes} min</div>
          <h3 className="text-xl font-bold">{item.title}</h3>
          {item.description && <p className="mt-2 line-clamp-3 text-sm text-zinc-400">{item.description}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {item.tags.map(tag => <span className="rounded-full bg-zinc-800 px-2 py-1 text-xs" key={tag}>{tag}</span>)}
          </div>
          <button className="btn mt-5" onClick={() => openProject(item)}>
            {mode === 'lld' ? 'View problem' : 'Start'}
          </button>
        </article>)}
      </div>
    </section>}

    {session && active && <section>
      {mode === 'machine_coding' && <div className="card mb-4">
        <b>Target structure</b>
        <pre className="mt-3 text-sm text-zinc-400">{project?.files?.map(file => file.path).join('\n')}</pre>
      </div>}

      {mode === 'lld' && <div className="card mb-4">
        <b>{project?.title}</b>
        <p className="mt-2 text-sm text-zinc-400">{project?.description}</p>
      </div>}

      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">{active.unit_type === 'class' ? active.pattern_tag : project?.title}</p>
          <h2 className="text-xl font-bold">{active.name || active.path}</h2>
        </div>
        <div className="rounded-xl border border-zinc-800 px-4 py-2 font-mono text-xl">{formatTime(left)}</div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="card h-fit">
          <b>{mode === 'lld' ? 'Classes' : 'Files'}</b>
          <div className="mt-3 space-y-2">
            {units.map(unit => <button
              className={`block w-full rounded-lg p-2 text-left text-xs ${active.id === unit.id ? 'bg-zinc-700' : 'bg-zinc-950'}`}
              key={unit.id}
              onClick={() => setActiveId(unit.id)}
            >
              <div>{unit.name || unit.path}</div>
              {unit.pattern_tag && <div className="mt-1 text-zinc-500">{unit.pattern_tag}</div>}
            </button>)}
          </div>
        </aside>

        <div>
          {mode === 'machine_coding' && <input
            className="mb-3 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 font-mono text-sm"
            placeholder="Type the file path from memory"
            value={paths[active.id] || ''}
            onChange={e => setPaths({ ...paths, [active.id]: e.target.value })}
          />}

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="card">
              <div className="mb-3 text-sm font-semibold text-zinc-400">Reference</div>
              <pre className="max-h-[560px] overflow-auto whitespace-pre-wrap font-mono text-xs">{active.reference_code}</pre>
            </div>
            <div className="card">
              <div className="mb-3 text-sm font-semibold text-zinc-400">Your code</div>
              <textarea
                className="min-h-[560px] w-full resize-none rounded-xl bg-zinc-950 p-4 font-mono text-xs outline-none"
                value={typed[active.id] || ''}
                disabled={submitted}
                onChange={e => setTyped({ ...typed, [active.id]: e.target.value })}
                spellCheck={false}
              />
            </div>
          </div>
        </div>
      </div>

      <button className="btn mt-4" disabled={submitted} onClick={submit}>Submit round</button>
    </section>}

    {message && <div className="card mt-5 text-sm">{message}</div>}
  </main>;
}
