// TEST ONLY. Fixed statement labels, synthetic request IDs, durations and physical locks.
// Never records SQL, bound parameters, errors/messages, results, user IDs or credentials.
import {performance} from 'node:perf_hooks';
export function sqlPhase(sql){
 if(sql.startsWith('BEGIN'))return 'begin';if(sql==='COMMIT')return 'commit';if(sql==='ROLLBACK')return 'rollback';
 if(sql.startsWith('INSERT INTO farmakon.members'))return 'member-upsert';
 if(sql.startsWith('INSERT INTO farmakon.activity'))return 'activity-upsert';
 if(sql.startsWith('INSERT INTO farmakon.records'))return 'record-upsert';
 if(sql.startsWith('UPDATE farmakon.records'))return 'record-update';
 if(sql.includes('FROM farmakon.activity'))return 'activity-read';
 if(sql.includes('FROM farmakon.enrollments'))return 'entitlement-read';
 if(sql.includes('FROM farmakon.records')&&sql.includes("->>'userId'"))return sql.includes("->>'status'")?'active-attempt-read':'own-record-read';
 if(sql.includes('FROM farmakon.records')&&sql.includes("->>'status'"))return 'catalogue-read';
 if(sql.includes('FROM farmakon.records')&&sql.includes('WHERE id='))return 'record-lookup';
 return 'other';
}
export function createTrace({context=()=>null,observer,maxEvents=1600,sampleLocks=false}={}){
 const events=[],attempts=new Map(),counts={},codes={},tails=new Map();let dropped=0;
 const emit=e=>{counts[e.phase]=(counts[e.phase]||0)+1;if(e.sqlstate)codes[e.sqlstate]=(codes[e.sqlstate]||0)+1;const tail=tails.get(e.request)||[];tail.push(e);if(tail.length>140)tail.shift();tails.set(e.request,tail);if(events.length<maxEvents)events.push(e);else dropped++;};
 async function locks(pid){if(!observer)return [];const r=await observer.query("SELECT pid,locktype,mode,relation::regclass::text AS relation,page,tuple FROM pg_locks WHERE pid=$1 AND mode='SIReadLock' ORDER BY relation,page,tuple LIMIT 30",[pid]);return r.rows;}
 function instrument(raw,attempt){const c=context()||{},request=c.requestId||'control';attempts.set(request,Math.max(attempts.get(request)||0,attempt+1));emit({request,pid:raw.processID,attempt:attempt+1,phase:'acquire'});return {processID:raw.processID,async query(sql,args){const phase=sqlPhase(sql),t=performance.now();let code;try{return await raw.query(sql,args);}catch(e){code=/^[0-9A-Z]{5}$/.test(e.code||'')?e.code:'OTHER';throw e;}finally{emit({request,pid:raw.processID,attempt:attempt+1,phase,durationMs:Number((performance.now()-t).toFixed(3)),...(code?{sqlstate:code}:{}),...(sampleLocks&&phase.endsWith('read')?{locks:await locks(raw.processID)}:{})});}},release(discard){raw.release(discard);emit({request,pid:raw.processID,attempt:attempt+1,phase:'release'});}};}
 return {instrument,locks,emit,requestTrace:id=>tails.get(id)||[],summary:()=>({events,counts,sqlstates:codes,attempts:Object.fromEntries(attempts),retries:[...attempts.values()].reduce((a,n)=>a+n-1,0),dropped})};
}
