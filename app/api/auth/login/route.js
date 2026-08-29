import {NextResponse} from 'next/server';
import {createSession,sessionCookieName} from '@/lib/auth';

export async function POST(request){
  const {username,password}=await request.json();
  if(username!==(process.env.AUTH_USERNAME||'akash')||password!==(process.env.AUTH_PASSWORD||'interviewdrill')){
    return NextResponse.json({error:'Invalid credentials'},{status:401});
  }
  const token=await createSession({id:'primary-user',username});
  const response=NextResponse.json({ok:true});
  response.cookies.set(sessionCookieName,token,{
    httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',
    maxAge:7*24*60*60,path:'/'
  });
  return response;
}
