import express from 'express';
import { pool } from './db.js';

const app = express();
const port = Number(process.env.PORT || 4001);
app.use(express.json({ limit: '2mb' }));

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data, error: null });
const fail = (res, status, error) => res.status(status).json({ success: false, data: null, error });

app.get('/health', (_req, res) => ok(res, { service: 'content-service', ok: true }));

app.get('/projects', async (req, res, next) => {
  try {
    const values = [];
    const clauses = [];
    if (req.query.category) {
      values.push(req.query.category);
      clauses.push(`category = $${values.length}`);
    }
    if (req.query.difficulty) {
      values.push(req.query.difficulty);
      clauses.push(`difficulty = $${values.length}`);
    }
    const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
    const result = await pool.query(
      `SELECT id,title,category,difficulty,estimated_minutes,tags,created_at
       FROM projects ${where} ORDER BY created_at DESC`,
      values
    );
    ok(res, result.rows);
  } catch (error) { next(error); }
});

app.post('/projects', async (req, res, next) => {
  try {
    const { title, category, difficulty, estimated_minutes = 10, tags = [] } = req.body;
    if (!title || !category || !difficulty) return fail(res, 400, 'title, category and difficulty are required');
    const result = await pool.query(
      `INSERT INTO projects(title,category,difficulty,estimated_minutes,tags)
       VALUES($1,$2,$3,$4,$5) RETURNING *`,
      [title, category, difficulty, estimated_minutes, tags]
    );
    ok(res, result.rows[0], 201);
  } catch (error) { next(error); }
});

app.get('/projects/:id', async (req, res, next) => {
  try {
    const project = await pool.query('SELECT * FROM projects WHERE id=$1', [req.params.id]);
    if (!project.rowCount) return fail(res, 404, 'Project not found');
    const files = await pool.query(
      'SELECT id,project_id,folder_node_id,path,reference_code,language,order_index FROM files WHERE project_id=$1 ORDER BY order_index,id',
      [req.params.id]
    );
    const nodes = await pool.query(
      'SELECT id,project_id,parent_id,name,type FROM folder_nodes WHERE project_id=$1 ORDER BY name',
      [req.params.id]
    );
    ok(res, { ...project.rows[0], files: files.rows, folder_nodes: nodes.rows });
  } catch (error) { next(error); }
});

app.patch('/projects/:id', async (req, res, next) => {
  try {
    const current = await pool.query('SELECT * FROM projects WHERE id=$1', [req.params.id]);
    if (!current.rowCount) return fail(res, 404, 'Project not found');
    const p = { ...current.rows[0], ...req.body };
    const updated = await pool.query(
      `UPDATE projects SET title=$1,category=$2,difficulty=$3,estimated_minutes=$4,tags=$5
       WHERE id=$6 RETURNING *`,
      [p.title,p.category,p.difficulty,p.estimated_minutes,p.tags,req.params.id]
    );
    ok(res, updated.rows[0]);
  } catch (error) { next(error); }
});

app.delete('/projects/:id', async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM projects WHERE id=$1 RETURNING id', [req.params.id]);
    if (!result.rowCount) return fail(res, 404, 'Project not found');
    ok(res, { deleted: true, id: req.params.id });
  } catch (error) { next(error); }
});

app.post('/projects/:id/folder-nodes', async (req, res, next) => {
  try {
    const { parent_id = null, name, type } = req.body;
    if (!name || !type) return fail(res, 400, 'name and type are required');
    const result = await pool.query(
      'INSERT INTO folder_nodes(project_id,parent_id,name,type) VALUES($1,$2,$3,$4) RETURNING *',
      [req.params.id,parent_id,name,type]
    );
    ok(res, result.rows[0], 201);
  } catch (error) { next(error); }
});

app.get('/folder-nodes/:id', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM folder_nodes WHERE id=$1', [req.params.id]);
    if (!result.rowCount) return fail(res, 404, 'Folder node not found');
    ok(res, result.rows[0]);
  } catch (error) { next(error); }
});

app.patch('/folder-nodes/:id', async (req, res, next) => {
  try {
    const current = await pool.query('SELECT * FROM folder_nodes WHERE id=$1', [req.params.id]);
    if (!current.rowCount) return fail(res, 404, 'Folder node not found');
    const n = { ...current.rows[0], ...req.body };
    const updated = await pool.query(
      'UPDATE folder_nodes SET parent_id=$1,name=$2,type=$3 WHERE id=$4 RETURNING *',
      [n.parent_id,n.name,n.type,req.params.id]
    );
    ok(res, updated.rows[0]);
  } catch (error) { next(error); }
});

app.delete('/folder-nodes/:id', async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM folder_nodes WHERE id=$1 RETURNING id', [req.params.id]);
    if (!result.rowCount) return fail(res, 404, 'Folder node not found');
    ok(res, { deleted: true, id: req.params.id });
  } catch (error) { next(error); }
});

app.post('/projects/:id/files', async (req, res, next) => {
  try {
    const { folder_node_id = null, path, reference_code, language, order_index = 0 } = req.body;
    if (!path || reference_code == null || !language) return fail(res, 400, 'path, reference_code and language are required');
    const result = await pool.query(
      `INSERT INTO files(project_id,folder_node_id,path,reference_code,language,order_index)
       VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.params.id,folder_node_id,path,reference_code,language,order_index]
    );
    ok(res, result.rows[0], 201);
  } catch (error) { next(error); }
});

app.get('/files/:id', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM files WHERE id=$1', [req.params.id]);
    if (!result.rowCount) return fail(res, 404, 'File not found');
    ok(res, result.rows[0]);
  } catch (error) { next(error); }
});

app.patch('/files/:id', async (req, res, next) => {
  try {
    const current = await pool.query('SELECT * FROM files WHERE id=$1', [req.params.id]);
    if (!current.rowCount) return fail(res, 404, 'File not found');
    const f = { ...current.rows[0], ...req.body };
    const updated = await pool.query(
      `UPDATE files SET folder_node_id=$1,path=$2,reference_code=$3,language=$4,order_index=$5
       WHERE id=$6 RETURNING *`,
      [f.folder_node_id,f.path,f.reference_code,f.language,f.order_index,req.params.id]
    );
    ok(res, updated.rows[0]);
  } catch (error) { next(error); }
});

app.delete('/files/:id', async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM files WHERE id=$1 RETURNING id', [req.params.id]);
    if (!result.rowCount) return fail(res, 404, 'File not found');
    ok(res, { deleted: true, id: req.params.id });
  } catch (error) { next(error); }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  fail(res, 500, 'Content service error');
});

app.listen(port, () => console.log(`Content Service listening on :${port}`));
