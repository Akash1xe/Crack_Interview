'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';

export default function LoginPage(){
  const router=useRouter();
  const[username,setUsername]=useState('akash');
  const[password,setPassword]=useState('');
  const[error,setError]=useState('');
  const[loading,setLoading]=useState(false);

  async function submit(e){
    e.preventDefault();setLoading(true);setError('');
    try{
      const r=await fetch('/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username,password})});
      const body=await r.json();
      if(!r.ok)throw new Error(body.error||'Login failed');
      router.replace('/');router.refresh();
    }catch(err){setError(err.message);}finally{setLoading(false);}
  }

  return <main className="mx-auto flex min-h-screen max-w-md items-center p-6">
    <form onSubmit={submit} className="card w-full">
      <div className="text-xs uppercase tracking-[.2em] text-zinc-500">Vercel edition</div>
      <h1 className="mt-2 text-3xl font-black">InterviewDrill</h1>
      <p className="mt-2 text-sm text-zinc-400">Sign in with the credentials configured in Vercel environment variables.</p>
      <input className="input mt-5" value={username} onChange={e=>setUsername(e.target.value)} placeholder="Username"/>
      <input className="input mt-3" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password"/>
      <button className="btn mt-4 w-full" disabled={loading}>{loading?'Signing in…':'Sign in'}</button>
      {error&&<p className="mt-3 text-sm text-red-300">{error}</p>}
    </form>
  </main>;
}
