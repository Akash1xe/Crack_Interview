import jwt from 'jsonwebtoken';

export const accessSecret=()=>process.env.JWT_ACCESS_SECRET||'change-me-access';
export const refreshSecret=()=>process.env.JWT_REFRESH_SECRET||'change-me-refresh';

export function issueAccess(user){
  return jwt.sign({sub:user.id,username:user.username,type:'access'},accessSecret(),{expiresIn:'15m'});
}

export function issueRefresh(user){
  return jwt.sign({sub:user.id,username:user.username,type:'refresh'},refreshSecret(),{expiresIn:'7d'});
}

export function verifyAccess(token){
  const payload=jwt.verify(token,accessSecret());
  if(payload.type!=='access')throw new Error('Wrong token type');
  return payload;
}

export function verifyRefresh(token){
  const payload=jwt.verify(token,refreshSecret());
  if(payload.type!=='refresh')throw new Error('Wrong token type');
  return payload;
}
