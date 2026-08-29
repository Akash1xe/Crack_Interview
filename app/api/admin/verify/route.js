import {NextResponse} from 'next/server';
import {requireUser} from '@/lib/auth';

export async function POST(request){
  try{
    await requireUser();
    if(request.headers.get('x-admin-pin')!==(process.env.ADMIN_PIN||'2468'))return NextResponse.json({error:'Invalid admin PIN'},{status:401});
    return NextResponse.json({data:{verified:true}});
  }catch{
    return NextResponse.json({error:'Unauthorized'},{status:401});
  }
}
