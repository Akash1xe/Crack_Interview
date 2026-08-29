import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { LLDProblem, Project, Session, Snippet } from './models.js';
import { itemMetrics, overall } from './scoring.js';
import { seed } from './seed.js';

const app=express();
app.use(cors()); app.use(express.json({limit:'2mb'}));

const cleanProject=(p:any)=>({ ...p.toObject(), files:p.files.map((f:any)=>({...f.toObject(),code:undefined})) });
app.get('/api/health',(_,res)=>res.json({ok:true}));
app.get('/api/snippets',async(req,res)=>{const q:any={};if(req.query.category&&req.query.category!=='mixed')q.category={$in:String(req.query.category).split(',')};res.json(await Snippet.find(q));});
app.get('/api/projects',async(req,res)=>{const q:any={};if(req.query.category)q.category=req.query.category;if(req.query.difficulty)q.difficulty=req.query.difficulty;res.json((await Project.find(q)).map(cleanProject));});
app.get('/api/projects/:id',async(req,res)=>{const p=await Project.findById(req.params.id);if(!p)return res.sendStatus(404);res.json(p);});
app.get('/api/lld',async(_req,res)=>res.json((await LLDProblem.find()).map(p=>({...p.toObject(),files:p.files.map((f:any)=>({...f.toObject(),code:undefined}))}))));
app.get('/api/lld/:id',async(req,res)=>{const p=await LLDProblem.findById(req.params.id);if(!p)return res.sendStatus(404);res.json(p);});

app.post('/api/metrics/item',(req,res)=>{const {typed,reference,timeTakenSeconds}=req.body;res.json(itemMetrics(typed||'',reference||'',Number(timeTakenSeconds)||0));});
app.post('/api/sessions',async(req,res)=>{
 const b=req.body;const computed=overall(b.type,b.itemsAttempted,b.timeLimitSeconds??null,b.timeTakenSeconds,!!b.finishedBeforeTimeout);
 const doc=await Session.create({type:b.type,mode:b.mode,refId:b.refId||null,itemsAttempted:b.itemsAttempted,overall:computed});
 res.status(201).json(doc);
});
app.get('/api/sessions',async(_req,res)=>res.json(await Session.find().sort({createdAt:-1}).limit(100)));
app.get('/api/dashboard',async(_req,res)=>{
 const sessions=await Session.find().sort({createdAt:1});
 const avg=(k:'avgWpm'|'avgAccuracy')=>sessions.length?sessions.reduce((s:any,x:any)=>s+(x.overall?.[k]||0),0)/sessions.length:0;
 res.json({attempts:sessions.length,avgWpm:+avg('avgWpm').toFixed(1),avgAccuracy:+avg('avgAccuracy').toFixed(1),recent:sessions.slice(-10)});
});

const admin=(req:any,res:any,next:any)=>req.header('x-admin-pin')===process.env.ADMIN_PIN?next():res.status(401).json({error:'Invalid admin PIN'});
app.post('/api/admin/verify',admin,(_req,res)=>res.json({ok:true}));
app.post('/api/admin/snippets',admin,async(req,res)=>res.status(201).json(await Snippet.create(req.body)));
app.post('/api/admin/projects',admin,async(req,res)=>res.status(201).json(await Project.create(req.body)));
app.post('/api/admin/lld',admin,async(req,res)=>res.status(201).json(await LLDProblem.create(req.body)));

const port=Number(process.env.PORT||4000);
await mongoose.connect(process.env.MONGO_URI||'mongodb://localhost:27017/backendtyper');
await seed();
app.listen(port,()=>console.log(`BackendTyper API on :${port}`));
