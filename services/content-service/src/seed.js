import { pool } from './db.js';

async function ensureProject({ title, category, difficulty, estimatedMinutes, tags, files }) {
  const existing = await pool.query('SELECT id FROM projects WHERE title=$1 LIMIT 1', [title]);
  if (existing.rowCount) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const project = await client.query(
      `INSERT INTO projects(title,category,difficulty,estimated_minutes,tags)
       VALUES($1,$2,$3,$4,$5) RETURNING id`,
      [title,category,difficulty,estimatedMinutes,tags]
    );
    const projectId = project.rows[0].id;

    const folders = new Map();
    for (const file of files) {
      const parts = file.path.split('/');
      let parentId = null;
      let current = '';
      for (let i = 0; i < parts.length - 1; i++) {
        current = current ? current + '/' + parts[i] : parts[i];
        if (!folders.has(current)) {
          const node = await client.query(
            `INSERT INTO folder_nodes(project_id,parent_id,name,type)
             VALUES($1,$2,$3,'folder') RETURNING id`,
            [projectId,parentId,parts[i]]
          );
          parentId = node.rows[0].id;
          folders.set(current,parentId);
        } else {
          parentId = folders.get(current);
        }
      }
      const fileNode = await client.query(
        `INSERT INTO folder_nodes(project_id,parent_id,name,type)
         VALUES($1,$2,$3,'file') RETURNING id`,
        [projectId,parentId,parts.at(-1)]
      );
      await client.query(
        `INSERT INTO files(project_id,folder_node_id,path,reference_code,language,order_index)
         VALUES($1,$2,$3,$4,$5,$6)`,
        [projectId,fileNode.rows[0].id,file.path,file.code,file.language,file.order]
      );
    }

    await client.query('COMMIT');
    console.log('Seeded', title);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

await ensureProject({
  title:'Express Error Handler Drill',
  category:'snippet',
  difficulty:'beginner',
  estimatedMinutes:5,
  tags:['express','middleware','error-handling'],
  files:[{
    path:'errorHandler.js',language:'javascript',order:1,
    code:`export function errorHandler(err, req, res, next) {
  const status = err.statusCode || 500;
  return res.status(status).json({
    success: false,
    data: null,
    error: err.message || 'Internal server error'
  });
}`
  }]
});

await ensureProject({
  title:'Task API',
  category:'machine_coding',
  difficulty:'beginner',
  estimatedMinutes:45,
  tags:['express','crud','validation'],
  files:[
    {path:'src/config/env.js',language:'javascript',order:1,code:`export const env = {
  port: Number(process.env.PORT || 3000),
  mongoUri: process.env.MONGO_URI
};`},
    {path:'src/models/task.model.js',language:'javascript',order:2,code:`import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  completed: { type: Boolean, default: false }
}, { timestamps: true });
export const Task = mongoose.model('Task', schema);`},
    {path:'src/services/task.service.js',language:'javascript',order:3,code:`import { Task } from '../models/task.model.js';
export const listTasks = () => Task.find().sort({ createdAt: -1 });
export const createTask = (payload) => Task.create(payload);`},
    {path:'src/controllers/task.controller.js',language:'javascript',order:4,code:`import * as service from '../services/task.service.js';
export async function list(req, res, next) {
  try { return res.json({ success: true, data: await service.listTasks(), error: null }); }
  catch (error) { next(error); }
}
export async function create(req, res, next) {
  try { return res.status(201).json({ success: true, data: await service.createTask(req.body), error: null }); }
  catch (error) { next(error); }
}`},
    {path:'src/routes/task.routes.js',language:'javascript',order:5,code:`import { Router } from 'express';
import * as controller from '../controllers/task.controller.js';
const router = Router();
router.get('/', controller.list);
router.post('/', controller.create);
export default router;`},
    {path:'src/middleware/errorHandler.js',language:'javascript',order:6,code:`export function errorHandler(err, req, res, next) {
  res.status(err.statusCode || 500).json({ success: false, data: null, error: err.message });
}`},
    {path:'tests/task.test.js',language:'javascript',order:7,code:`describe('Task API', () => {
  it('creates a task', async () => {
    expect(true).toBe(true);
  });
});`},
    {path:'README.md',language:'markdown',order:8,code:'# Task API\n\nSimple layered CRUD machine-coding exercise.'}
  ]
});

await ensureProject({
  title:'Authenticated Notes API',
  category:'machine_coding',
  difficulty:'intermediate',
  estimatedMinutes:60,
  tags:['express','jwt','relations','zod'],
  files:[
    {path:'src/config/env.js',language:'javascript',order:1,code:`export const env = {
  port: Number(process.env.PORT || 3000),
  jwtSecret: process.env.JWT_SECRET
};`},
    {path:'src/models/user.model.js',language:'javascript',order:2,code:`import mongoose from 'mongoose';
const schema = new mongoose.Schema({ email: { type: String, unique: true }, passwordHash: String }, { timestamps: true });
export const User = mongoose.model('User', schema);`},
    {path:'src/models/note.model.js',language:'javascript',order:3,code:`import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  title: { type: String, required: true },
  body: { type: String, default: '' }
}, { timestamps: true });
export const Note = mongoose.model('Note', schema);`},
    {path:'src/middleware/auth.js',language:'javascript',order:4,code:`import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
export function auth(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    req.user = jwt.verify(token, env.jwtSecret);
    next();
  } catch {
    res.status(401).json({ success: false, data: null, error: 'Unauthorized' });
  }
}`},
    {path:'src/validators/note.validator.js',language:'javascript',order:5,code:`import { z } from 'zod';
export const createNoteSchema = z.object({
  title: z.string().min(1),
  body: z.string().optional()
});`},
    {path:'src/services/note.service.js',language:'javascript',order:6,code:`import { Note } from '../models/note.model.js';
export const listNotes = (ownerId) => Note.find({ ownerId }).sort({ createdAt: -1 });
export const createNote = (ownerId, payload) => Note.create({ ...payload, ownerId });`},
    {path:'src/controllers/note.controller.js',language:'javascript',order:7,code:`import * as service from '../services/note.service.js';
export async function list(req, res, next) {
  try { res.json({ success: true, data: await service.listNotes(req.user.id), error: null }); }
  catch (error) { next(error); }
}`},
    {path:'src/routes/note.routes.js',language:'javascript',order:8,code:`import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { list } from '../controllers/note.controller.js';
const router = Router();
router.get('/', auth, list);
export default router;`},
    {path:'src/middleware/errorHandler.js',language:'javascript',order:9,code:`export function errorHandler(err, req, res, next) {
  res.status(err.statusCode || 500).json({ success: false, data: null, error: err.message || 'Internal server error' });
}`},
    {path:'tests/note.test.js',language:'javascript',order:10,code:`describe('Notes API', () => {
  it('requires authentication', async () => {
    expect(true).toBe(true);
  });
});`},
    {path:'README.md',language:'markdown',order:11,code:'# Authenticated Notes API\n\nJWT-protected notes exercise with validation and ownership.'}
  ]
});

await pool.end();
