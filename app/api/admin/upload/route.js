import {NextResponse} from 'next/server';
import AdmZip from 'adm-zip';
import {requireUser} from '@/lib/auth';
import {createProjectWithUnits} from '@/lib/db';

export const runtime='nodejs';

const tagsForPath=path=>{
  const tags=[];
  for(const [re,tag] of [[/controller/i,'controller'],[/service/i,'service'],[/route/i,'route'],[/middleware/i,'middleware'],[/model/i,'model'],[/test|spec/i,'testing'],[/\.py$/i,'python'],[/\.(js|ts)$/i,'javascript'],[/\.(cpp|hpp|h)$/i,'cpp']])if(re.test(path))tags.push(tag);
  return tags;
};

export async function POST(request){
  try{
    await requireUser();
    if(request.headers.get('x-admin-pin')!==(process.env.ADMIN_PIN||'2468'))return NextResponse.json({error:'Invalid admin PIN'},{status:401});
    const form=await request.formData();
    const archive=form.get('archive');
    if(!archive||typeof archive.arrayBuffer!=='function')return NextResponse.json({error:'ZIP archive required'},{status:400});
    if(archive.size>5*1024*1024)return NextResponse.json({error:'ZIP must be 5 MB or smaller'},{status:400});
    const zip=new AdmZip(Buffer.from(await archive.arrayBuffer()));
    const entries=zip.getEntries().filter(e=>!e.isDirectory&&!e.entryName.includes('node_modules/')).slice(0,100);
    if(!entries.length)return NextResponse.json({error:'ZIP contains no importable files'},{status:400});
    const units=entries.map((entry,index)=>{
      const path=entry.entryName.replace(/^\.\//,'');
      const ext=path.split('.').pop()?.toLowerCase();
      const language=ext==='py'?'python':['cpp','hpp','h'].includes(ext)?'cpp':ext==='json'?'json':'javascript';
      return {kind:'file',name:path.split('/').at(-1),path,reference_code:entry.getData().toString('utf8'),language,order_index:index+1};
    });
    const tags=[...new Set(units.flatMap(u=>tagsForPath(u.path)))];
    const project=await createProjectWithUnits({
      title:String(form.get('title')||archive.name.replace(/\.zip$/i,'')),
      description:String(form.get('description')||'Imported from ZIP'),
      category:'machine_coding',
      difficulty:String(form.get('difficulty')||'intermediate'),
      estimated_minutes:Number(form.get('estimated_minutes')||60),
      tags
    },units);
    return NextResponse.json({data:{project,files_imported:units.length,tags}},{status:201});
  }catch(error){
    return NextResponse.json({error:error.message},{status:error.message==='UNAUTHORIZED'?401:500});
  }
}
