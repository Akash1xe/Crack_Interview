import {NextResponse} from 'next/server';
import {requireUser} from '@/lib/auth';
import {progressForUser} from '@/lib/db';

export const dynamic='force-dynamic';

export async function GET(){
  try{
    const user=await requireUser();
    return NextResponse.json({data:await progressForUser(user.id)});
  }catch(error){
    if(error.message==='UNAUTHORIZED')return NextResponse.json({error:'Unauthorized'},{status:401});
    return NextResponse.json({error:error.message},{status:500});
  }
}
