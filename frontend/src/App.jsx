import { useEffect, useMemo, useState } from 'react';
import { api } from './api.js';

function formatTime(total) {
  const seconds = Math.max(0, total);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function App() {
  const [projects, setProjects] = useState([]);
  const [project, setProject] = useState(null);
  const [session, setSession] = useState(null);
  const [typed, setTyped] = useState('');
  const [left, setLeft] = useState(0);
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    api('/content/projects?category=snippet')
      .then(setProjects)
      .catch(error => setMessage(error.message));
  }, []);

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

  const referenceFile = useMemo(() => {
    return session?.reference_snapshot?.files?.[0] || null;
  }, [session]);

  async function start(selected) {
    try {
      setMessage('');
      const full = await api('/content/projects/' + selected.id);
      setProject(full);
      const created = await api('/sessions', {
        method: 'POST',
        body: JSON.stringify({
          project_id: selected.id,
          time_limit_seconds: selected.estimated_minutes * 60
        })
      });
      setSession(created);
      setTyped('');
      setSubmitted(false);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function submit() {
    if (!session || !referenceFile || submitted) return;
    try {
      setSubmitted(true);
      const result = await api('/sessions/' + session.id + '/submit', {
        method: 'POST',
        body: JSON.stringify({
          files: [{
            file_id_ref: referenceFile.id,
            typed_code: typed,
            typed_path: referenceFile.path
          }]
        })
      });
      setSession(result);
      setMessage('Session submitted successfully. Phase 0 plumbing is working end-to-end.');
    } catch (error) {
      setSubmitted(false);
      setMessage(error.message);
    }
  }

  useEffect(() => {
    if (left === 0 && session?.status === 'in_progress' && referenceFile && !submitted) {
      submit();
    }
  }, [left, session?.status, referenceFile, submitted]);

  return <main className="mx-auto max-w-6xl p-6">
    <header className="mb-8">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">Phase 0</p>
      <h1 className="mt-2 text-4xl font-black">InterviewDrill</h1>
      <p className="mt-2 max-w-2xl text-zinc-400">
        Gateway → Session Service → Content Service, with isolated Postgres databases.
      </p>
    </header>

    {!session && <section>
      <h2 className="mb-4 text-xl font-bold">Snippet Drills</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {projects.map(item => <article className="card" key={item.id}>
          <div className="mb-3 flex gap-2 text-xs text-zinc-400">
            <span>{item.difficulty}</span><span>•</span><span>{item.estimated_minutes} min</span>
          </div>
          <h3 className="text-xl font-bold">{item.title}</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {item.tags.map(tag => <span className="rounded-full bg-zinc-800 px-2 py-1 text-xs" key={tag}>{tag}</span>)}
          </div>
          <button className="btn mt-5" onClick={() => start(item)}>Start drill</button>
        </article>)}
      </div>
    </section>}

    {session && referenceFile && <section>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-500">{project?.title}</p>
          <h2 className="text-xl font-bold">{referenceFile.path}</h2>
        </div>
        <div className="rounded-xl border border-zinc-800 px-4 py-2 font-mono text-xl">{formatTime(left)}</div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="mb-3 text-sm font-semibold text-zinc-400">Reference</div>
          <pre className="overflow-auto whitespace-pre-wrap font-mono text-sm">{referenceFile.reference_code}</pre>
        </div>
        <div className="card">
          <div className="mb-3 text-sm font-semibold text-zinc-400">Your code</div>
          <textarea
            className="min-h-[420px] w-full resize-none rounded-xl bg-zinc-950 p-4 font-mono text-sm outline-none"
            value={typed}
            disabled={submitted}
            onChange={event => setTyped(event.target.value)}
            spellCheck={false}
          />
        </div>
      </div>

      <div className="mt-4 flex gap-3">
        <button className="btn" disabled={submitted} onClick={submit}>Submit session</button>
        <button className="rounded-xl border border-zinc-700 px-4 py-2" onClick={() => { setSession(null); setProject(null); setMessage(''); }}>
          Back
        </button>
      </div>
    </section>}

    {message && <div className="card mt-5 text-sm">{message}</div>}
  </main>;
}
