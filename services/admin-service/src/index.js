import express from 'express';
import multer from 'multer';
import AdmZip from 'adm-zip';

const app=express();
const port=Number(process.env.PORT||4005);
const rawContentUrl=process.env.CONTENT_SERVICE_URL||'localhost:4001';
const contentUrl=/^https?:\/\//i.test(rawContentUrl)?rawContentUrl:`http://${rawContentUrl}`;
const adminPin=process.env.ADMIN_PIN||'2468';
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024}});

app.use(express.json({limit:'4mb'}));
const ok=(res,data,status=200)=>res.status(status).json({success:true,data,error:null});
const fail=(res,status,error)=>res.status(status).json({success:false,data:null,error});

app.use((req,res,next)=>{
  if(req.path==='/health')return next();
  if(req.headers['x-admin-pin']!==adminPin)return fail(res,401,'Invalid admin PIN');
  next();
});

async function content(path,options={}){
  const response=await fetch(contentUrl+path,{
    ...options,
    headers:{'Content-Type':'application/json',...(options.headers||{})}
  });
  const body=await response.json();
  if(!response.ok)throw new Error(body.error||'Content Service request failed');
  return body.data;
}

function tagsForPath(path){
  const tags=[];
  if(/controller/i.test(path))tags.push('controller');
  if(/service/i.test(path))tags.push('service');
  if(/route/i.test(path))tags.push('route');
  if(/middleware/i.test(path))tags.push('middleware');
  if(/model/i.test(path))tags.push('model');
  if(/test|spec/i.test(path))tags.push('testing');
  if(/\.py$/i.test(path))tags.push('python');
  if(/\.(js|ts)$/i.test(path))tags.push('javascript');
  if(/\.(cpp|hpp|h)$/i.test(path))tags.push('cpp');
  return tags;
}

async function createProjectWithFiles(payload){
  const project=await content('/projects',{
    method:'POST',
    body:JSON.stringify({
      title:payload.title,
      description:payload.description||'',
      category:payload.category,
      difficulty:payload.difficulty,
      estimated_minutes:Number(payload.estimated_minutes||45),
      tags:[...new Set(payload.tags||[])]
    })
  });

  for(const [index,file] of (payload.files||[]).entries()){
    await content(`/projects/${project.id}/files`,{
      method:'POST',
      body:JSON.stringify({
        path:file.path,
        reference_code:file.reference_code,
        language:file.language||'javascript',
        order_index:file.order_index??index+1
      })
    });
  }

  for(const [index,item] of (payload.lld_classes||[]).entries()){
    await content(`/projects/${project.id}/lld-classes`,{
      method:'POST',
      body:JSON.stringify({
        name:item.name,
        reference_code:item.reference_code,
        pattern_tag:item.pattern_tag||'none',
        order_index:item.order_index??index+1
      })
    });
  }

  return content('/projects/'+project.id);
}

app.get('/health',(_req,res)=>ok(res,{service:'admin-service',ok:true}));
app.post('/verify',(_req,res)=>ok(res,{verified:true}));

app.post('/projects',async(req,res,next)=>{
  try{ok(res,await createProjectWithFiles(req.body),201);}
  catch(error){next(error);}
});

app.post('/upload-zip',upload.single('archive'),async(req,res,next)=>{
  try{
    if(!req.file)return fail(res,400,'ZIP archive is required');
    const zip=new AdmZip(req.file.buffer);
    const entries=zip.getEntries().filter(entry=>!entry.isDirectory&&!entry.entryName.includes('node_modules/'));
    const files=entries.map((entry,index)=>{
      const path=entry.entryName.replace(/^\.\//,'');
      const ext=path.split('.').pop()?.toLowerCase();
      const language=ext==='py'?'python':['cpp','hpp','h'].includes(ext)?'cpp':ext==='json'?'json':'javascript';
      return {
        path,
        reference_code:entry.getData().toString('utf8'),
        language,
        order_index:index+1
      };
    });
    const derivedTags=[...new Set(files.flatMap(file=>tagsForPath(file.path)))];
    const project=await createProjectWithFiles({
      title:req.body.title||req.file.originalname.replace(/\.zip$/i,''),
      description:req.body.description||'Imported from ZIP archive',
      category:req.body.category||'machine_coding',
      difficulty:req.body.difficulty||'intermediate',
      estimated_minutes:Number(req.body.estimated_minutes||60),
      tags:derivedTags,
      files
    });
    ok(res,{project,files_imported:files.length,derived_tags:derivedTags},201);
  }catch(error){next(error);}
});

app.use((error,_req,res,_next)=>{
  console.error(error);
  fail(res,500,error.message||'Admin service error');
});

app.listen(port,()=>console.log(`Admin Service listening on :${port}`));
