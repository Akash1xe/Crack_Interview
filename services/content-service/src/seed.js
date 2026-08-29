import { pool } from './db.js';

const existing = await pool.query("SELECT id FROM projects WHERE title = $1 LIMIT 1", ['Express Error Handler Drill']);
if (existing.rowCount === 0) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const project = await client.query(
      `INSERT INTO projects(title, category, difficulty, estimated_minutes, tags)
       VALUES ($1,'snippet','beginner',5,$2)
       RETURNING id`,
      ['Express Error Handler Drill', ['express','middleware','error-handling']]
    );

    const projectId = project.rows[0].id;
    const node = await client.query(
      `INSERT INTO folder_nodes(project_id, parent_id, name, type)
       VALUES ($1,NULL,'errorHandler.js','file')
       RETURNING id`,
      [projectId]
    );

    const code = `export function errorHandler(err, req, res, next) {
  const status = err.statusCode || 500;
  return res.status(status).json({
    success: false,
    data: null,
    error: err.message || 'Internal server error'
  });
}`;

    await client.query(
      `INSERT INTO files(project_id, folder_node_id, path, reference_code, language, order_index)
       VALUES ($1,$2,'errorHandler.js',$3,'javascript',1)`,
      [projectId, node.rows[0].id, code]
    );
    await client.query('COMMIT');
    console.log('Seeded Express Error Handler Drill');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
} else {
  console.log('Content seed already present');
}
await pool.end();
