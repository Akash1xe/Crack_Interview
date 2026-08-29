import {NextResponse} from 'next/server';
import {requireUser} from '@/lib/auth';
import {finishSession,getSession} from '@/lib/db';
import {classifyMistakes,textMetrics} from '@/lib/scoring.mjs';

export async function POST(request,{params}){
  try{
    const user=await requireUser();
    const session=await getSession(params.id);
    if(!session||session.user_id!==user.id)return NextResponse.json({error:'Session not found'},{status:404});
    if(session.status!=='in_progress')return NextResponse.json({error:'Session already submitted'},{status:409});

    const body=await request.json();
    const submissions=Array.isArray(body.units)?body.units:[];
    const refs=new Map((session.reference_snapshot.units||[]).map(u=>[u.id,u]));
    const timeUsed=Math.min(session.time_limit_seconds,Math.max(1,Math.round((Date.now()-new Date(session.started_at).getTime())/1000)));
    const perUnit=Math.max(1,Math.round(timeUsed/Math.max(refs.size,1)));
    const results=[];

    for(const ref of refs.values()){
      const submitted=submissions.find(x=>x.unit_id_ref===ref.id)||{unit_id_ref:ref.id,typed_code:'',typed_path:''};
      const metrics=textMetrics(submitted.typed_code||'',ref.reference_code||'',Number(submitted.time_spent_seconds)||perUnit);
      const mistakes=classifyMistakes(submitted.typed_code||'',ref.reference_code||'');
      if(session.category==='lld'&&ref.pattern_tag&&ref.pattern_tag!=='none')mistakes.push('pattern:'+ref.pattern_tag);
      results.push({
        unit_id_ref:ref.id,
        label:ref.name||ref.path,
        char_accuracy:metrics.accuracy,
        correct_path:session.category==='lld'?true:(submitted.typed_path||'')===ref.path,
        wpm:metrics.wpm,
        mistakes_json:mistakes,
        completed:Boolean((submitted.typed_code||'').trim())
      });
    }

    const total=Math.max(1,results.length);
    const overall=results.reduce((s,r)=>s+r.char_accuracy,0)/total;
    const completion=100*results.filter(r=>r.completed).length/total;
    const structure=session.category==='lld'?100:100*results.filter(r=>r.correct_path).length/total;
    const avgWpm=results.reduce((s,r)=>s+r.wpm,0)/total;
    const weakest=[...results].sort((a,b)=>a.char_accuracy-b.char_accuracy)[0];
    const summary=session.category==='lld'
      ? results.filter(r=>r.completed).length+'/'+total+' classes completed, '+overall.toFixed(1)+'% average accuracy. Weakest class: '+(weakest?.label||'n/a')+'.'
      : results.filter(r=>r.correct_path).length+'/'+total+' files correctly structured, '+overall.toFixed(1)+'% average accuracy, '+completion.toFixed(1)+'% complete.';

    const report=await finishSession(params.id,submissions,{
      overall_accuracy:overall,completion_pct:completion,structure_score:structure,
      avg_wpm:avgWpm,time_used_seconds:timeUsed,summary_text:summary,results
    });
    return NextResponse.json({data:report});
  }catch(error){
    if(error.message==='UNAUTHORIZED')return NextResponse.json({error:'Unauthorized'},{status:401});
    return NextResponse.json({error:error.message},{status:500});
  }
}
