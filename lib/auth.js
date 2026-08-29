import {SignJWT,jwtVerify} from 'jose';
import {cookies} from 'next/headers';

const COOKIE='interviewdrill_session';
const secret=()=>new TextEncoder().encode(process.env.SESSION_SECRET||'local-development-secret-change-me');

export async function createSession(user){
  return new SignJWT({username:user.username})
    .setProtectedHeader({alg:'HS256'})
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret());
}

export async function verifySession(token){
  const {payload}=await jwtVerify(token,secret());
  return {id:String(payload.sub),username:String(payload.username||'')};
}

export async function currentUser(){
  const token=cookies().get(COOKIE)?.value;
  if(!token)return null;
  try{return await verifySession(token);}catch{return null;}
}

export async function requireUser(){
  const user=await currentUser();
  if(!user)throw new Error('UNAUTHORIZED');
  return user;
}

export const sessionCookieName=COOKIE;
