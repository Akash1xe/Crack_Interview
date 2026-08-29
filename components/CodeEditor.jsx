'use client';
import dynamic from 'next/dynamic';

const Editor=dynamic(()=>import('@monaco-editor/react').then(m=>m.default),{ssr:false});
const DiffEditor=dynamic(()=>import('@monaco-editor/react').then(m=>m.DiffEditor),{ssr:false});

const options={minimap:{enabled:false},fontSize:14,automaticLayout:true,scrollBeyondLastLine:false,wordWrap:'off'};

export function CodeEditor({value,onChange,language='javascript',height='56vh'}){
  return <Editor height={height} theme="vs-dark" language={language==='cpp'?'cpp':language} value={value} onChange={v=>onChange(v||'')} options={options}/>;
}

export function CodeDiff({reference,value,onChange,language='javascript'}){
  return <DiffEditor height="62vh" theme="vs-dark" original={reference} modified={value} language={language==='cpp'?'cpp':language}
    onMount={editor=>editor.getModifiedEditor().onDidChangeModelContent(()=>onChange(editor.getModifiedEditor().getValue()))}
    options={{...options,renderSideBySide:true,originalEditable:false}}/>;
}
