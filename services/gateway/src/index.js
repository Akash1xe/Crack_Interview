import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { issueAccess,issueRefresh,verifyAccess,verifyRefresh } from './auth.js';

const asInternalUrl=(value,fallback)=>{
  const raw=value||fallback;
  return /^https?:\/\//i.test(raw)?raw:`http://${raw}`;
};
const asPublicOrigin=(value,fallback)=>{
  const raw=value||fallback;
  return /^https?:\/\//i.test(raw)?raw:`https://${raw}`;
};

const app=express();
const port=Number(process.env.PORT||4000);
const contentUrl=asInternalUrl(process.env.CONTENT_SERVICE_URL,'localhost:4001');
const sessionUrl=asInternalUrl(process.env.SESSION_SERVICE_URL,'localhost:4002');
const evaluationUrl=asInternalUrl(process.env.EVALUATION_SERVICE_URL,'localhost:4003');
const progressUrl=asInternalUrl(process.env.PROGRESS_SERVICE_URL,'localhost:4004');
const adminUrl=asInternalUrl(process.env.ADMIN_SERVICE_URL,'localhost:4005');
const frontendOrigin=asPublicOrigin(process.env.FRONTEND_ORIGIN,'http://localhost:5173');
const authUsername=process.env.AUTH_USERNAME||'akash';
const authPassword=process.env.AUTH_PASSWORD||'interviewdrill';

app.use(cors({origin:frontendOrigin,credentials:true}));
app.use(cookieParser());
app.use(rateLimit({windowMs:60_000,limit:180,standardHeaders:true,legacyHeaders:false}));
app.get('/health',(_req,res)=>res.json({service:'gateway',ok:true}));

const authLimiter=rateLimit({windowMs:15*60_000,limit:10,standardHeaders:true,legacyHeaders:false});
const sessionLimiter=rateLimit({windowMs:60_000,limit:30,standardHeaders:true,legacyHeaders:false});

app.post('/api/auth/login',authLimiter,express.json(),(req,res)=>{
  const {username,password}=req.body||{};
  if(username!==authUsername||password!==authPassword){
    return res.status(401).json({success:false,data:null,error:'Invalid credentials'});
  }
  const user={id:'dev-user',username:authUsername};
  const accessToken=issueAccess(user);
  const refreshToken=issueRefresh(user);
  res.cookie('interviewdrill_refresh',refreshToken,{
    httpOnly:true,
    sameSite:'lax',
    secure:process.env.NODE_ENV==='production',
    maxAge:7*24*60*60*1000,
    path:'/api/auth'
  });
  res.json({success:true,data:{access_token:accessToken,user},error:null});
});

app.post('/api/auth/refresh',authLimiter,(req,res)=>{
  try{
    const token=req.cookies.interviewdrill_refresh;
    if(!token)throw new Error('Missing refresh token');
    const payload=verifyRefresh(token);
    const user={id:payload.sub,username:payload.username};
    res.json({success:true,data:{access_token:issueAccess(user),user},error:null});
  }catch{
    res.status(401).json({success:false,data:null,error:'Refresh token expired or invalid'});
  }
});

app.post('/api/auth/logout',(req,res)=>{
  res.clearCookie('interviewdrill_refresh',{path:'/api/auth'});
  res.json({success:true,data:{logged_out:true},error:null});
});

app.use('/api',(req,res,next)=>{
  try{
    const token=req.headers.authorization?.replace(/^Bearer\s+/i,'');
    if(!token)throw new Error('Missing token');
    const payload=verifyAccess(token);
    req.headers['x-user-id']=String(payload.sub);
    req.headers['x-username']=String(payload.username||'');
    next();
  }catch{
    res.status(401).json({success:false,data:null,error:'Access token expired or invalid'});
  }
});

app.use('/api/sessions',sessionLimiter,createProxyMiddleware({target:sessionUrl,changeOrigin:true,pathRewrite:path=>'/sessions'+path}));
app.use('/api/content',createProxyMiddleware({target:contentUrl,changeOrigin:true}));
app.use('/api/evaluations',createProxyMiddleware({target:evaluationUrl,changeOrigin:true,pathRewrite:path=>'/reports'+path}));
app.use('/api/progress',createProxyMiddleware({target:progressUrl,changeOrigin:true}));
app.use('/api/admin',createProxyMiddleware({target:adminUrl,changeOrigin:true}));

app.use((err,_req,res,_next)=>{
  console.error(err);
  res.status(502).json({success:false,data:null,error:'Gateway upstream error'});
});

app.listen(port,()=>console.log(`Gateway listening on :${port}`));
