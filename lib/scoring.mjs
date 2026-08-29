export function levenshtein(a='',b=''){
  const prev=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){
    let diagonal=prev[0];
    prev[0]=i;
    for(let j=1;j<=b.length;j++){
      const old=prev[j];
      prev[j]=Math.min(prev[j]+1,prev[j-1]+1,diagonal+(a[i-1]===b[j-1]?0:1));
      diagonal=old;
    }
  }
  return prev[b.length];
}

export function textMetrics(typed='',reference='',seconds=1){
  const errors=levenshtein(typed,reference);
  const accuracy=Math.max(0,100*(1-errors/Math.max(reference.length,1)));
  const wpm=seconds>0?(typed.length/5)/(seconds/60):0;
  return {errors,accuracy:+accuracy.toFixed(2),wpm:+wpm.toFixed(2)};
}

export function classifyMistakes(typed='',reference=''){
  const out=[];
  if(/\basync\b/.test(reference)&&!/\basync\b/.test(typed))out.push('missing_async');
  if(reference.includes('$')&&!typed.includes('$'))out.push('missing_mongodb_operator');
  if(reference.includes('next(error)')&&!typed.includes('next(error)'))out.push('missing_error_propagation');
  if(reference.includes('try')&&!typed.includes('try'))out.push('missing_try_catch');
  if(reference.includes('await')&&!typed.includes('await'))out.push('missing_await');
  return out;
}
