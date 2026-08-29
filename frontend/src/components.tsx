import Editor,{DiffEditor} from '@monaco-editor/react';
import { Link,NavLink } from 'react-router-dom';

const options={minimap:{enabled:false},fontSize:14,wordWrap:'off' as const,automaticLayout:true,scrollBeyondLastLine:false};

export const CodeEditor=({value,onChange,language='javascript',readOnly=false,height='52vh'}:{value:string,onChange?:(v:string)=>void,language?:string,readOnly?:boolean,height?:string})=>
  <Editor height={height} theme="vs-dark" language={language==='cpp'?'cpp':language} value={value} onChange={v=>onChange?.(v||'')} options={{...options,readOnly}}/>;

export const DiffCodeEditor=({reference,value,onChange,language='javascript'}:{reference:string,value:string,onChange:(v:string)=>void,language?:string})=>
  <DiffEditor height="62vh" theme="vs-dark" original={reference} modified={value} language={language==='cpp'?'cpp':language}
    onMount={editor=>editor.getModifiedEditor().onDidChangeModelContent(()=>onChange(editor.getModifiedEditor().getValue()))}
    options={{...options,renderSideBySide:true,originalEditable:false}}/>;

export function Shell({children}:{children:any}){return <><header className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4"><Link to="/" className="font-black tracking-tight">BackendTyper</Link><nav className="flex flex-wrap gap-4 text-sm text-zinc-400">{[['/drills','Drills'],['/machine-coding','Machine Coding'],['/lld','LLD'],['/history','History'],['/admin','Admin']].map(([to,n])=><NavLink key={to} to={to} className={({isActive})=>isActive?'text-white':'hover:text-white'}>{n}</NavLink>)}</nav></div></header><main className="mx-auto max-w-7xl p-5">{children}</main></>;}
export const Stat=({label,value}:{label:string,value:any})=><div className="card"><div className="text-xs uppercase tracking-wider text-zinc-500">{label}</div><div className="mt-2 text-3xl font-black">{value}</div></div>;
export function Tree({paths}:{paths:string[]}){return <pre className="overflow-auto rounded-xl bg-zinc-950 p-4 text-sm text-zinc-300">{paths.join('\n')}</pre>}
export const Meter=({label,value,suffix=''}:{label:string,value:number,suffix?:string})=><div><div className="mb-1 flex justify-between text-xs text-zinc-400"><span>{label}</span><span>{value.toFixed(1)}{suffix}</span></div><div className="h-2 overflow-hidden rounded bg-zinc-800"><div className="h-full bg-zinc-200" style={{width:Math.max(0,Math.min(100,value))+'%'}}/></div></div>;
