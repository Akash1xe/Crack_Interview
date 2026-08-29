export function levenshtein(a:string,b:string){
  const prev=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){
    let diagonal=prev[0]; prev[0]=i;
    for(let j=1;j<=b.length;j++){
      const old=prev[j];
      prev[j]=Math.min(prev[j]+1,prev[j-1]+1,diagonal+(a[i-1]===b[j-1]?0:1));
      diagonal=old;
    }
  }
  return prev[b.length];
}
export function itemMetrics(typed:string,reference:string,seconds:number){
  const errors=levenshtein(typed,reference);
  const accuracy=Math.max(0,100*(1-errors/Math.max(reference.length,1)));
  const wpm=seconds>0?(typed.length/5)/(seconds/60):0;
  return {errorCount:errors,accuracy:+accuracy.toFixed(2),wpm:+wpm.toFixed(2)};
}
export function weakest(items:any[]){
  const groups=new Map<string,number[]>();
  for(const i of items){if(!i.group)continue; const a=groups.get(i.group)||[];a.push(i.accuracy);groups.set(i.group,a);}
  const eligible=[...groups].filter(([,v])=>v.length>=2).map(([k,v])=>[k,v.reduce((a,b)=>a+b,0)/v.length] as const);
  eligible.sort((a,b)=>a[1]-b[1]); return eligible[0]?.[0]||'Not enough data';
}
export function overall(type:string,items:any[],timeLimitSeconds:number|null,timeTakenSeconds:number,finishedBeforeTimeout:boolean){
  const active=items.length||1;
  const avgWpm=items.reduce((s,i)=>s+i.wpm,0)/active;
  const avgAccuracy=items.reduce((s,i)=>s+i.accuracy,0)/active;
  const totalErrors=items.reduce((s,i)=>s+i.errorCount,0);
  const completed=items.filter(i=>!i.skipped).length;
  const completionPercent=100*completed/active;
  const structureScore=type==='machine-coding'?100*items.filter(i=>i.structureCorrect).length/active:100;
  const timeBonus=type==='machine-coding'?(finishedBeforeTimeout?1.2:0.8):1;
  const score=Math.round(avgWpm*(avgAccuracy/100)*(type==='machine-coding'?structureScore/100:1)*(type==='drill'?1:completionPercent/100)*timeBonus);
  return {avgWpm:+avgWpm.toFixed(2),avgAccuracy:+avgAccuracy.toFixed(2),totalErrors,completionPercent:+completionPercent.toFixed(2),timeLimitSeconds,timeTakenSeconds,score,weakestArea:weakest(items)};
}
