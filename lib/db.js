import {neon} from '@neondatabase/serverless';
import crypto from 'node:crypto';

const connection=process.env.DATABASE_URL;
if(!connection)console.warn('DATABASE_URL is not configured');
const sql=connection?neon(connection):null;
let initPromise=null;
const id=()=>crypto.randomUUID();

async function seedProject(project,units){
  const found=await sql`SELECT id FROM projects WHERE title=${project.title} LIMIT 1`;
  if(found.length)return;
  const projectId=id();
  await sql`INSERT INTO projects(id,title,description,category,difficulty,estimated_minutes,tags)
    VALUES(${projectId},${project.title},${project.description||''},${project.category},${project.difficulty},${project.estimatedMinutes},${JSON.stringify(project.tags||[])}::jsonb)`;
  for(const [index,unit] of units.entries()){
    await sql`INSERT INTO units(id,project_id,kind,name,path,reference_code,language,order_index,pattern_tag)
      VALUES(${id()},${projectId},${unit.kind||'file'},${unit.name||unit.path},${unit.path||unit.name},${unit.code},${unit.language||'javascript'},${unit.order||index+1},${unit.pattern||'none'})`;
  }
}

async function seed(){
  await seedProject({
    title:'Express Error Handler',description:'Practice a production-style centralized Express error handler.',category:'snippet',difficulty:'beginner',estimatedMinutes:5,tags:['express','middleware','error-handling']
  },[{path:'errorHandler.js',code:`export function errorHandler(error, req, res, next) {
  const status = error.statusCode || 500;
  return res.status(status).json({
    success: false,
    data: null,
    error: error.message || 'Internal server error'
  });
}`}]);

  await seedProject({
    title:'Mongo Update Query',description:'Recall a common Mongoose update pattern with validation.',category:'snippet',difficulty:'beginner',estimatedMinutes:5,tags:['mongodb','mongoose','query']
  },[{path:'updateUser.js',code:`const user = await User.findOneAndUpdate(
  { _id: userId },
  { $set: { name } },
  { new: true, runValidators: true }
);`}]);

  await seedProject({
    title:'Async Controller',description:'Practice controller/service separation and error propagation.',category:'snippet',difficulty:'beginner',estimatedMinutes:5,tags:['express','controller','async']
  },[{path:'user.controller.js',code:`export async function createUser(req, res, next) {
  try {
    const user = await userService.create(req.body);
    return res.status(201).json({ success: true, data: user, error: null });
  } catch (error) {
    next(error);
  }
}`}]);

  await seedProject({
    title:'URL Shortener API',description:'Beginner machine-coding round with routing, service separation and centralized errors.',category:'machine_coding',difficulty:'beginner',estimatedMinutes:45,tags:['express','mongodb','crud']
  },[
    {path:'src/models/url.model.js',code:`import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  originalUrl: { type: String, required: true },
  shortCode: { type: String, unique: true, index: true },
  clicks: { type: Number, default: 0 }
}, { timestamps: true });
export const Url = mongoose.model('Url', schema);`},
    {path:'src/services/url.service.js',code:`import { Url } from '../models/url.model.js';
export const createShortUrl = (originalUrl, shortCode) =>
  Url.create({ originalUrl, shortCode });
export const findByCode = (shortCode) =>
  Url.findOneAndUpdate({ shortCode }, { $inc: { clicks: 1 } }, { new: true });`},
    {path:'src/controllers/url.controller.js',code:`import * as service from '../services/url.service.js';
export async function shorten(req, res, next) {
  try {
    const data = await service.createShortUrl(req.body.originalUrl, req.body.shortCode);
    return res.status(201).json({ success: true, data, error: null });
  } catch (error) { next(error); }
}`},
    {path:'src/routes/url.routes.js',code:`import { Router } from 'express';
import { shorten } from '../controllers/url.controller.js';
const router = Router();
router.post('/shorten', shorten);
export default router;`},
    {path:'src/middleware/errorHandler.js',code:`export function errorHandler(error, req, res, next) {
  res.status(error.statusCode || 500).json({ success: false, data: null, error: error.message });
}`},
    {path:'README.md',language:'markdown',code:'# URL Shortener API\n\nLayered Express + MongoDB interview exercise.'}
  ]);

  await seedProject({
    title:'Rate Limiter Service',description:'Intermediate round implementing token bucket middleware and configurable limits.',category:'machine_coding',difficulty:'intermediate',estimatedMinutes:60,tags:['express','rate-limit','service']
  },[
    {path:'src/services/tokenBucket.service.js',code:`export class TokenBucket {
  constructor(capacity, refillPerSecond) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillPerSecond = refillPerSecond;
    this.lastRefill = Date.now();
  }
  consume() {
    const now = Date.now();
    this.tokens = Math.min(this.capacity, this.tokens + ((now - this.lastRefill) / 1000) * this.refillPerSecond);
    this.lastRefill = now;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}`},
    {path:'src/middleware/rateLimiter.js',code:`import { TokenBucket } from '../services/tokenBucket.service.js';
const buckets = new Map();
export const rateLimit = (options) => (req, res, next) => {
  const key = req.ip;
  const bucket = buckets.get(key) || new TokenBucket(options.capacity, options.refillPerSecond);
  buckets.set(key, bucket);
  if (!bucket.consume()) return res.status(429).json({ success: false, data: null, error: 'Rate limit exceeded' });
  next();
};`},
    {path:'src/routes/api.routes.js',code:`import { Router } from 'express';
import { rateLimit } from '../middleware/rateLimiter.js';
const router = Router();
router.get('/limited', rateLimit({ capacity: 5, refillPerSecond: 1 }), (req, res) =>
  res.json({ success: true, data: 'ok', error: null })
);
export default router;`},
    {path:'tests/rateLimiter.test.js',code:`describe('rate limiter', () => {
  it('blocks requests once capacity is exhausted', () => {
    expect(true).toBe(true);
  });
});`},
    {path:'README.md',language:'markdown',code:'# Rate Limiter Service\n\nToken bucket middleware machine-coding exercise.'}
  ]);

  await seedProject({
    title:'Cart & Order Service',description:'Advanced layered API with auth, validation, inventory call and async-style order processing.',category:'machine_coding',difficulty:'advanced',estimatedMinutes:90,tags:['express','jwt','validation','queue']
  },[
    {path:'src/middleware/auth.js',code:`import jwt from 'jsonwebtoken';
export function auth(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ success: false, data: null, error: 'Unauthorized' });
  }
}`},
    {path:'src/services/inventory.client.js',code:`export async function reserveInventory(items) {
  const response = await fetch(process.env.INVENTORY_URL + '/reserve', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ items })
  });
  if (!response.ok) throw new Error('Inventory unavailable');
  return response.json();
}`},
    {path:'src/services/order.service.js',code:`import { reserveInventory } from './inventory.client.js';
import { Order } from '../models/order.model.js';
export async function createOrder(userId, items) {
  await reserveInventory(items);
  return Order.create({ userId, items, status: 'PENDING' });
}`},
    {path:'src/controllers/order.controller.js',code:`import { createOrder } from '../services/order.service.js';
export async function create(req, res, next) {
  try {
    const data = await createOrder(req.user.id, req.body.items);
    return res.status(202).json({ success: true, data, error: null });
  } catch (error) { next(error); }
}`},
    {path:'src/routes/order.routes.js',code:`import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { create } from '../controllers/order.controller.js';
const router = Router();
router.post('/', auth, create);
export default router;`},
    {path:'README.md',language:'markdown',code:'# Cart & Order Service\n\nAdvanced interview project with layered architecture.'}
  ]);

  await seedProject({
    title:'Parking Lot System',description:'Design parking spots, assignment policy and parking-lot coordination.',category:'lld',difficulty:'advanced',estimatedMinutes:60,tags:['cpp','strategy','factory']
  },[
    {kind:'class',name:'Vehicle',language:'cpp',pattern:'Factory',code:`enum class VehicleType { Motorcycle, Car, Truck };
class Vehicle {
protected:
    string license;
    VehicleType type;
public:
    Vehicle(string license, VehicleType type) : license(move(license)), type(type) {}
    virtual ~Vehicle() = default;
    VehicleType getType() const { return type; }
};`},
    {kind:'class',name:'SpotAssignmentStrategy',language:'cpp',pattern:'Strategy',code:`class SpotAssignmentStrategy {
public:
    virtual ParkingSpot* findSpot(vector<unique_ptr<ParkingSpot>>& spots, const Vehicle& vehicle) = 0;
    virtual ~SpotAssignmentStrategy() = default;
};`},
    {kind:'class',name:'ParkingLot',language:'cpp',pattern:'Strategy',code:`class ParkingLot {
    vector<unique_ptr<ParkingSpot>> spots;
    unique_ptr<SpotAssignmentStrategy> strategy;
public:
    explicit ParkingLot(unique_ptr<SpotAssignmentStrategy> strategy) : strategy(move(strategy)) {}
    ParkingSpot* findSpot(const Vehicle& vehicle) { return strategy->findSpot(spots, vehicle); }
};`}
  ]);

  await seedProject({
    title:'LRU Cache',description:'Implement O(1) get/put using a hash map and doubly linked list.',category:'lld',difficulty:'intermediate',estimatedMinutes:35,tags:['cpp','hashmap','linked-list']
  },[
    {kind:'class',name:'Node',language:'cpp',pattern:'none',code:`class Node {
public:
    int key, value;
    Node *prev = nullptr, *next = nullptr;
    Node(int key, int value) : key(key), value(value) {}
};`},
    {kind:'class',name:'LRUCache',language:'cpp',pattern:'none',code:`class LRUCache {
    int capacity;
    unordered_map<int, Node*> cache;
public:
    explicit LRUCache(int capacity) : capacity(capacity) {}
    int get(int key) {
        if (!cache.count(key)) return -1;
        return cache[key]->value;
    }
};`}
  ]);

  await seedProject({
    title:'Rate Limiter LLD',description:'Implement interchangeable token bucket and sliding-window strategies.',category:'lld',difficulty:'intermediate',estimatedMinutes:45,tags:['cpp','strategy','rate-limit']
  },[
    {kind:'class',name:'RateLimiterStrategy',language:'cpp',pattern:'Strategy',code:`class RateLimiterStrategy {
public:
    virtual bool allow(const string& key) = 0;
    virtual ~RateLimiterStrategy() = default;
};`},
    {kind:'class',name:'TokenBucketLimiter',language:'cpp',pattern:'Strategy',code:`class TokenBucketLimiter : public RateLimiterStrategy {
    double capacity;
    double tokens;
public:
    explicit TokenBucketLimiter(double capacity) : capacity(capacity), tokens(capacity) {}
    bool allow(const string& key) override {
        if (tokens < 1) return false;
        tokens -= 1;
        return true;
    }
};`}
  ]);

  await seedProject({
    title:'Elevator System',description:'Design elevators with state and replaceable dispatch strategy.',category:'lld',difficulty:'advanced',estimatedMinutes:60,tags:['cpp','strategy','state']
  },[
    {kind:'class',name:'Elevator',language:'cpp',pattern:'State',code:`enum class Direction { Up, Down, Idle };
class Elevator {
    int floor = 0;
    Direction direction = Direction::Idle;
public:
    int currentFloor() const { return floor; }
    Direction currentDirection() const { return direction; }
};`},
    {kind:'class',name:'DispatchStrategy',language:'cpp',pattern:'Strategy',code:`class DispatchStrategy {
public:
    virtual Elevator* select(vector<unique_ptr<Elevator>>& elevators, int requestedFloor) = 0;
    virtual ~DispatchStrategy() = default;
};`},
    {kind:'class',name:'ElevatorController',language:'cpp',pattern:'Strategy',code:`class ElevatorController {
    vector<unique_ptr<Elevator>> elevators;
    unique_ptr<DispatchStrategy> strategy;
public:
    explicit ElevatorController(unique_ptr<DispatchStrategy> strategy) : strategy(move(strategy)) {}
};`}
  ]);
}

export async function ensureDb(){
  if(!sql)throw new Error('DATABASE_URL is not configured');
  if(initPromise)return initPromise;
  initPromise=(async()=>{
    await sql`CREATE TABLE IF NOT EXISTS projects(
      id TEXT PRIMARY KEY,title TEXT NOT NULL UNIQUE,description TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL,difficulty TEXT NOT NULL,estimated_minutes INTEGER NOT NULL DEFAULT 10,
      tags JSONB NOT NULL DEFAULT '[]'::jsonb,created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS units(
      id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      kind TEXT NOT NULL DEFAULT 'file',name TEXT NOT NULL,path TEXT NOT NULL,
      reference_code TEXT NOT NULL,language TEXT NOT NULL DEFAULT 'javascript',
      order_index INTEGER NOT NULL DEFAULT 0,pattern_tag TEXT NOT NULL DEFAULT 'none'
    )`;
    await sql`CREATE TABLE IF NOT EXISTS sessions(
      id TEXT PRIMARY KEY,user_id TEXT NOT NULL,project_id TEXT NOT NULL,
      category TEXT NOT NULL,mode TEXT NOT NULL DEFAULT 'practice',
      started_at TIMESTAMPTZ NOT NULL DEFAULT now(),ended_at TIMESTAMPTZ,
      time_limit_seconds INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'in_progress',
      recall BOOLEAN NOT NULL DEFAULT false,recall_preview_seconds INTEGER NOT NULL DEFAULT 10,
      reference_snapshot JSONB NOT NULL
    )`;
    await sql`CREATE TABLE IF NOT EXISTS session_units(
      id TEXT PRIMARY KEY,session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      unit_id_ref TEXT NOT NULL,typed_code TEXT NOT NULL DEFAULT '',typed_path TEXT NOT NULL DEFAULT '',
      time_spent_seconds INTEGER NOT NULL DEFAULT 0
    )`;
    await sql`CREATE TABLE IF NOT EXISTS reports(
      id TEXT PRIMARY KEY,session_id TEXT NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
      overall_accuracy NUMERIC(6,2) NOT NULL,completion_pct NUMERIC(6,2) NOT NULL,
      structure_score NUMERIC(6,2) NOT NULL,avg_wpm NUMERIC(8,2) NOT NULL,
      time_used_seconds INTEGER NOT NULL,summary_text TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS unit_results(
      id TEXT PRIMARY KEY,report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
      unit_id_ref TEXT NOT NULL,label TEXT NOT NULL,char_accuracy NUMERIC(6,2) NOT NULL,
      correct_path BOOLEAN NOT NULL,wpm NUMERIC(8,2) NOT NULL,mistakes_json JSONB NOT NULL DEFAULT '[]'::jsonb
    )`;
    await seed();
  })();
  return initPromise;
}

export async function listProjects(category){
  await ensureDb();
  return category
    ? sql`SELECT * FROM projects WHERE category=${category} ORDER BY difficulty,title`
    : sql`SELECT * FROM projects ORDER BY category,difficulty,title`;
}

export async function getProject(projectId){
  await ensureDb();
  const rows=await sql`SELECT * FROM projects WHERE id=${projectId} LIMIT 1`;
  if(!rows.length)return null;
  const units=await sql`SELECT * FROM units WHERE project_id=${projectId} ORDER BY order_index,name`;
  return {...rows[0],units};
}

export async function createProjectWithUnits(project,units){
  await ensureDb();
  const projectId=id();
  await sql`INSERT INTO projects(id,title,description,category,difficulty,estimated_minutes,tags)
    VALUES(${projectId},${project.title},${project.description||''},${project.category},${project.difficulty},${Number(project.estimated_minutes||45)},${JSON.stringify(project.tags||[])}::jsonb)`;
  for(const [index,unit] of units.entries()){
    await sql`INSERT INTO units(id,project_id,kind,name,path,reference_code,language,order_index,pattern_tag)
      VALUES(${id()},${projectId},${unit.kind||'file'},${unit.name||unit.path},${unit.path||unit.name},${unit.reference_code},${unit.language||'javascript'},${unit.order_index??index+1},${unit.pattern_tag||'none'})`;
  }
  return getProject(projectId);
}

export async function createSession(userId,project,options){
  await ensureDb();
  const sessionId=id();
  const snapshot={project_id:project.id,title:project.title,description:project.description,category:project.category,difficulty:project.difficulty,units:project.units};
  await sql`INSERT INTO sessions(id,user_id,project_id,category,mode,time_limit_seconds,recall,recall_preview_seconds,reference_snapshot)
    VALUES(${sessionId},${userId},${project.id},${project.category},${options.mode||'practice'},${Number(options.time_limit_seconds)},${Boolean(options.recall)},${Number(options.recall_preview_seconds||10)},${JSON.stringify(snapshot)}::jsonb)`;
  for(const unit of project.units){
    await sql`INSERT INTO session_units(id,session_id,unit_id_ref,typed_path)
      VALUES(${id()},${sessionId},${unit.id},${project.category==='machine_coding'?'':unit.path})`;
  }
  const rows=await sql`SELECT * FROM sessions WHERE id=${sessionId}`;
  return rows[0];
}

export async function getSession(sessionId){
  await ensureDb();
  const rows=await sql`SELECT * FROM sessions WHERE id=${sessionId} LIMIT 1`;
  if(!rows.length)return null;
  const units=await sql`SELECT * FROM session_units WHERE session_id=${sessionId}`;
  return {...rows[0],units};
}

export async function finishSession(sessionId,submissions,reportInput){
  await ensureDb();
  for(const item of submissions){
    await sql`UPDATE session_units SET typed_code=${item.typed_code||''},typed_path=${item.typed_path||''},time_spent_seconds=${Number(item.time_spent_seconds||0)}
      WHERE session_id=${sessionId} AND unit_id_ref=${item.unit_id_ref}`;
  }
  await sql`UPDATE sessions SET status='submitted',ended_at=now() WHERE id=${sessionId}`;
  const reportId=id();
  await sql`INSERT INTO reports(id,session_id,overall_accuracy,completion_pct,structure_score,avg_wpm,time_used_seconds,summary_text)
    VALUES(${reportId},${sessionId},${reportInput.overall_accuracy},${reportInput.completion_pct},${reportInput.structure_score},${reportInput.avg_wpm},${reportInput.time_used_seconds},${reportInput.summary_text})`;
  for(const item of reportInput.results){
    await sql`INSERT INTO unit_results(id,report_id,unit_id_ref,label,char_accuracy,correct_path,wpm,mistakes_json)
      VALUES(${id()},${reportId},${item.unit_id_ref},${item.label},${item.char_accuracy},${item.correct_path},${item.wpm},${JSON.stringify(item.mistakes_json||[])}::jsonb)`;
  }
  const reports=await sql`SELECT * FROM reports WHERE id=${reportId}`;
  const results=await sql`SELECT * FROM unit_results WHERE report_id=${reportId} ORDER BY label`;
  return {...reports[0],results};
}

export async function progressForUser(userId){
  await ensureDb();
  const reports=await sql`SELECT r.*,s.category,s.project_id,p.title
    FROM reports r JOIN sessions s ON s.id=r.session_id JOIN projects p ON p.id=s.project_id
    WHERE s.user_id=${userId} ORDER BY r.created_at DESC LIMIT 50`;
  const resultRows=await sql`SELECT ur.mistakes_json,r.created_at
    FROM unit_results ur JOIN reports r ON r.id=ur.report_id JOIN sessions s ON s.id=r.session_id
    WHERE s.user_id=${userId}`;
  const groups={};
  for(const report of reports){
    const key=report.category;
    groups[key]??={category:key,totalAccuracy:0,totalWpm:0,count:0};
    groups[key].totalAccuracy+=Number(report.overall_accuracy);
    groups[key].totalWpm+=Number(report.avg_wpm);
    groups[key].count++;
  }
  const stats=Object.values(groups).map(g=>({category:g.category,avg_accuracy:g.totalAccuracy/g.count,avg_wpm:g.totalWpm/g.count,sessions_completed:g.count}));
  const counts={};
  for(const row of resultRows)for(const key of row.mistakes_json||[])counts[key]=(counts[key]||0)+1;
  const mistakes=Object.entries(counts).map(([pattern_key,occurrence_count])=>({pattern_key,occurrence_count})).sort((a,b)=>b.occurrence_count-a.occurrence_count).slice(0,12);
  return {stats,mistakes,events:reports.slice(0,20).reverse()};
}
