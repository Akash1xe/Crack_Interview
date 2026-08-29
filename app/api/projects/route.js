import {NextResponse} from 'next/server';
import {requireUser} from '@/lib/auth';
import {listProjects} from '@/lib/db';

export const dynamic='force-dynamic';

export async function GET(request){
  try{
    await requireUser();
    const category=new URL(request.url).searchParams.get('category')||undefined;
    return NextResponse.json({data:await listProjects(category)});
  }catch(error){
    if(error.message==='UNAUTHORIZED')return NextResponse.json({error:'Unauthorized'},{status:401});
    return NextResponse.json({error:error.message},{status:500});
  }
}
