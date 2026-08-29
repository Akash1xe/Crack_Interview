import {NextResponse} from 'next/server';
import {requireUser} from '@/lib/auth';
import {getProject} from '@/lib/db';

export const dynamic='force-dynamic';

export async function GET(_request,{params}){
  try{
    await requireUser();
    const project=await getProject(params.id);
    if(!project)return NextResponse.json({error:'Project not found'},{status:404});
    return NextResponse.json({data:project});
  }catch(error){
    if(error.message==='UNAUTHORIZED')return NextResponse.json({error:'Unauthorized'},{status:401});
    return NextResponse.json({error:error.message},{status:500});
  }
}
