import {NextResponse} from 'next/server';
import {requireUser} from '@/lib/auth';
import {createProjectWithUnits} from '@/lib/db';

export async function POST(request){
  try{
    await requireUser();
    if(request.headers.get('x-admin-pin')!==(process.env.ADMIN_PIN||'2468'))return NextResponse.json({error:'Invalid admin PIN'},{status:401});
    const body=await request.json();
    if(!body.title||!body.category||!body.difficulty||!Array.isArray(body.units)||!body.units.length){
      return NextResponse.json({error:'title, category, difficulty and at least one unit are required'},{status:400});
    }
    return NextResponse.json({data:await createProjectWithUnits(body,body.units)},{status:201});
  }catch(error){
    return NextResponse.json({error:error.message},{status:error.message==='UNAUTHORIZED'?401:500});
  }
}
