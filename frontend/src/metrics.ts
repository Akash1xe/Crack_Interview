export function distance(a:string,b:string){
  const prev=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){let diagonal=prev[0];prev[0]=i;for(let j=1;j<=b.length;j++){const old=prev[j];prev[j]=Math.min(prev[j]+1,prev[j-1]+1,diagonal+(a[i-1]===b[j-1]?0:1));diagonal=old;}}
  return prev[b.length];
}
export function liveMetrics(typed:string,reference:string,seconds:number){
  const errors=distance(typed,reference);
  const accuracy=Math.max(0,100*(1-errors/Math.max(1,reference.length)));
  const wpm=seconds>0?(typed.length/5)/(seconds/60):0;
  return {errors,accuracy:+accuracy.toFixed(1),wpm:+wpm.toFixed(1)};
}
