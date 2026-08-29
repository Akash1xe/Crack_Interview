const configured=import.meta.env.VITE_GATEWAY_URL||'http://localhost:4000/api';
const origin=/^https?:\/\//i.test(configured)?configured:`https://${configured}`;
const base=origin.endsWith('/api')?origin:origin.replace(/\/$/,'')+'/api';
let accessToken=sessionStorage.getItem('interviewdrill_access')||'';

function storeToken(token){
  accessToken=token||'';
  if(accessToken)sessionStorage.setItem('interviewdrill_access',accessToken);
  else sessionStorage.removeItem('interviewdrill_access');
}

async function raw(path,options={}){
  const isForm=typeof FormData!=='undefined'&&options.body instanceof FormData;
  const headers={
    ...(isForm?{}:{'Content-Type':'application/json'}),
    ...(accessToken?{Authorization:'Bearer '+accessToken}:{}),
    ...(options.headers||{})
  };
  return fetch(base+path,{...options,headers,credentials:'include'});
}

export async function login(username,password){
  const response=await raw('/auth/login',{method:'POST',body:JSON.stringify({username,password})});
  const body=await response.json();
  if(!response.ok)throw new Error(body.error||'Login failed');
  storeToken(body.data.access_token);
  return body.data.user;
}

export async function refreshAuth(){
  const response=await fetch(base+'/auth/refresh',{method:'POST',credentials:'include'});
  const body=await response.json();
  if(!response.ok){storeToken('');throw new Error(body.error||'Session expired');}
  storeToken(body.data.access_token);
  return body.data.user;
}

export async function logout(){
  try{await fetch(base+'/auth/logout',{method:'POST',credentials:'include'});}finally{storeToken('');}
}

export async function bootstrapAuth(){
  if(accessToken)return true;
  try{await refreshAuth();return true;}catch{return false;}
}

export async function api(path,options={},retry=true){
  let response=await raw(path,options);
  if(response.status===401&&retry&&!path.startsWith('/auth/')){
    try{await refreshAuth();response=await raw(path,options);}catch{storeToken('');}
  }
  const body=await response.json();
  if(!response.ok)throw new Error(body.error||'Request failed');
  return body.data;
}
