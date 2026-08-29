import {NextResponse} from 'next/server';
import {requireUser} from '@/lib/auth';
import {createSession,getProject} from '@/lib/db';

export async function POST(request){
  try{
    const user=await requireUser();
    const body=await request.json();
    const project=await getProject(body.project_id);
    if(!project)return NextResponse.json({error:'Project not found'},{status:404});
    const seconds=Number(body.time_limit_seconds);
    if(!Number.isFinite(seconds)||seconds<=0)return NextResponse.json({error:'Invalid time limit'},{status:400});
    const session=await createSession(user.id,project,{
      mode:body.mode||'practice',
      time_limit_seconds:seconds,
      recall:Boolean(body.recall),
      recall_preview_seconds:Math.min(60,Math.max(5,Number(body.recall_preview_seconds)||10))
    });
    return NextResponse.json({data:session},{status:201});
  }catch(error){
    if(error.message==='UNAUTHORIZED')return NextResponse.json({error:'Unauthorized'},{status:401});
    return NextResponse.json({error:error.message},{status:500});
  }
}
