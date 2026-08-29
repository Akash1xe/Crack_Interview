import express from 'express';
import { createClient } from 'redis';
import { pool } from './db.js';
import { scoreText, classifyMistakes } from './diff.js';

const app = express();
const port = Number(process.env.PORT || 4003);
const sessionUrl = process.env.SESSION_SERVICE_URL || 'http://localhost:4002';
const contentUrl = process.env.CONTENT_SERVICE_URL || 'http://localhost:4001';
const redis = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
redis.on('error', error => console.error('Redis error', error));
await redis.connect();

app.use(express.json());
const ok = (res, data, status = 200) => res.status(status).json({ success: true, data, error: null });
const fail = (res, status, error) => res.status(status).json({ success: false, data: null, error });

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Upstream request failed: ${url}`);
  const body = await response.json();
  return body.data;
}

async function processSession(sessionId) {
  const existing = await pool.query('SELECT id FROM reports WHERE session_id=$1', [sessionId]);
  if (existing.rowCount) return existing.rows[0].id;

  const session = await fetchJson(`${sessionUrl}/sessions/${sessionId}`);
  const project = await fetchJson(`${contentUrl}/projects/${session.project_id}`);
  const refs = new Map(project.files.map(file => [file.id, file]));
  const results = [];

  for (const submitted of session.files) {
    const ref = refs.get(submitted.file_id_ref);
    if (!ref) continue;

    const scored = scoreText(submitted.typed_code, ref.reference_code);
    results.push({
      file_id_ref: submitted.file_id_ref,
      char_accuracy: scored.accuracy,
      correct_path: submitted.typed_path === ref.path,
      time_spent_seconds: 0,
      mistakes_json: classifyMistakes(submitted.typed_code || '', ref.reference_code || ''),
      completed: Boolean(submitted.submitted_at && (submitted.typed_code || '').trim().length)
    });
  }

  const totalFiles = Math.max(1, project.files.length);
  const overallAccuracy = results.length
    ? results.reduce((sum, item) => sum + item.char_accuracy, 0) / results.length
    : 0;
  const completionPct = 100 * results.filter(item => item.completed).length / totalFiles;
  const structureScore = 100 * results.filter(item => item.correct_path).length / totalFiles;
  const timeUsed = Math.max(0, Math.round(
    (new Date(session.ended_at || Date.now()).getTime() - new Date(session.started_at).getTime()) / 1000
  ));
  const summary = `${results.filter(r => r.correct_path).length}/${totalFiles} files correctly structured, ${overallAccuracy.toFixed(1)}% average character accuracy, ${completionPct.toFixed(1)}% complete.`;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const report = await client.query(
      `INSERT INTO reports(session_id,overall_accuracy,completion_pct,structure_score,time_used_seconds,summary_text)
       VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
      [sessionId,overallAccuracy,completionPct,structureScore,timeUsed,summary]
    );

    for (const item of results) {
      await client.query(
        `INSERT INTO file_results(report_id,file_id_ref,char_accuracy,correct_path,time_spent_seconds,mistakes_json)
         VALUES($1,$2,$3,$4,$5,$6::jsonb)`,
        [report.rows[0].id,item.file_id_ref,item.char_accuracy,item.correct_path,item.time_spent_seconds,JSON.stringify(item.mistakes_json)]
      );
    }

    await client.query('COMMIT');

    await redis.xAdd('evaluation.completed', '*', {
      report_id: report.rows[0].id,
      session_id: sessionId,
      user_id: session.user_id,
      category: session.category
    });
    return report.rows[0].id;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function consumerLoop() {
  let lastId = '0-0';
  while (true) {
    try {
      const streams = await redis.xRead(
        [{ key: 'session.submitted', id: lastId }],
        { BLOCK: 5000, COUNT: 10 }
      );
      if (!streams) continue;

      for (const stream of streams) {
        for (const message of stream.messages) {
          lastId = message.id;
          try {
            await processSession(message.message.session_id);
          } catch (error) {
            console.error('Evaluation failed', message.message.session_id, error);
          }
        }
      }
    } catch (error) {
      console.error('Consumer loop error', error);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

app.get('/health', (_req, res) => ok(res, { service: 'evaluation-service', ok: true }));

app.get('/reports/session/:sessionId', async (req, res, next) => {
  try {
    const report = await pool.query('SELECT * FROM reports WHERE session_id=$1', [req.params.sessionId]);
    if (!report.rowCount) return fail(res, 404, 'Report not ready');
    const files = await pool.query('SELECT * FROM file_results WHERE report_id=$1 ORDER BY id', [report.rows[0].id]);
    ok(res, { ...report.rows[0], files: files.rows });
  } catch (error) { next(error); }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  fail(res, 500, 'Evaluation service error');
});

app.listen(port, () => console.log(`Evaluation Service listening on :${port}`));
consumerLoop();
