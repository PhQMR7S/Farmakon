// Two-client, barrier-ordered SSI component experiment. No load or cloud calls.
import assert from 'node:assert/strict';import fs from 'node:fs';import {Pool} from 'pg';
import {testDatabase} from './helpers/postgres.mjs';import {createTrace} from './helpers/pg-trace.mjs';
const {close}=await testDatabase();const observer=new Pool({connectionString:process.env.FARMAKON_TEST_DATABASE_URL,max:3,ssl:false});
const evidence={scope:'isolated PostgreSQL; two synthetic concurrent transactions, not a capacity test',cases:[],plans:[],trace:[]};
const now=Date.now(),u=i=>'rc-user-'+String(i).padStart(4,'0');
const at=i=>({userId:u(i),examId:'rc-exam',courseId:'rc-course',status:'active',answers:{},deadline:now+600000,questions:[]});
async function seed(n,from=0){await observer.query('BEGIN');try{for(let i=from;i<n;i++){await observer.query('INSERT INTO farmakon.members VALUES($1,$2,$3,$4)',[u(i),u(i)+'@example.test','Synthetic',now]);await observer.query('INSERT INTO farmakon.enrollments VALUES($1,$2,$3,$4,$5)',['en-'+i,u(i)+'@example.test','rc-course',now+86400000,'synthetic']);for(let j=0;j<3;j++){await observer.query('INSERT INTO farmakon.records VALUES($1,$2,$3,$4,$5)',['rc-at-'+i+'-'+j,'attempt','rc-course',JSON.stringify({...at(i),status:j===0?'active':'done'}),now-j]);await observer.query('INSERT INTO farmakon.activity VALUES($1,$2,$3,$4,$5,$6)',['rc-progress-'+i+'-'+j,u(i),'progress','lesson-'+j,'{}',now]);}}await observer.query('COMMIT');}catch(e){await observer.query('ROLLBACK');throw e;}}
const reads={
 'active-attempt-read':["SELECT * FROM farmakon.records WHERE kind='attempt' AND data::jsonb->>'userId'=$1 AND data::jsonb->>'status'='active' ORDER BY created DESC,id DESC",i=>[u(i)]],
 'attempt-lookup':['SELECT * FROM farmakon.records WHERE id=$1',i=>['rc-at-'+i+'-0']],
 'catalogue-course':["SELECT * FROM farmakon.records WHERE kind=$1 AND data::jsonb->>'status'='published' ORDER BY created DESC,id DESC",()=>['course']],
 'catalogue-announcement':["SELECT * FROM farmakon.records WHERE kind=$1 AND data::jsonb->>'status'='published' ORDER BY created DESC,id DESC",()=>['announcement']],
 'activity-read':['SELECT * FROM farmakon.activity WHERE user_id=$1',i=>[u(i)]],
 'entitlement-read':['SELECT * FROM farmakon.enrollments WHERE email=$1',i=>[u(i)+'@example.test']],
 'member-upsert':['INSERT INTO farmakon.members(id,email,name,created) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET email=excluded.email,name=excluded.name WHERE members.email<>excluded.email OR members.name<>excluded.name',i=>[u(i),u(i)+'@example.test','Synthetic',now]],
};
async function pair(size,phase,writeMode,repeat,state="before-analyze",students=[0,1]){
 const clients=[await observer.connect(),await observer.connect()],trace=createTrace({observer,maxEvents:100});const wrappers=clients.map((c,i)=>{let context={requestId:'r'+state+'-'+size+'-'+phase+'-'+writeMode+'-'+repeat+'-'+i};return createTrace({context:()=>context,observer,maxEvents:30});});
 const cs=clients.map((c,i)=>wrappers[i].instrument(c,0));const statuses=[null,null],codes=[];let step='begin';
 try{
  for(const c of cs)await c.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
  const [sql,args]=reads[phase];for(let i=0;i<2;i++)await cs[i].query(sql,args(students[i]));
  const locks=await Promise.all(clients.map(c=>trace.locks(c.processID)));
  step='write';for(let i=0;i<2;i++)try{if(writeMode==='activity')await cs[i].query('INSERT INTO farmakon.activity VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(user_id,kind,target) DO NOTHING',['rc-result-'+state+'-'+size+'-'+phase+'-'+repeat+'-'+i,u(students[i]),'exam','new-'+state+'-'+size+'-'+phase+'-'+repeat,'{}',now]);else if(writeMode==='update')await cs[i].query('UPDATE farmakon.records SET data=$1 WHERE id=$2',[JSON.stringify(at(students[i])),'rc-at-'+students[i]+'-0']);else await cs[i].query('INSERT INTO farmakon.records(id,kind,course_id,data,created) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET data=excluded.data,course_id=excluded.course_id',['rc-at-'+students[i]+'-0','attempt','rc-course',JSON.stringify(at(students[i])),now]);}catch(e){codes.push({client:i,stage:step,sqlstate:e.code});assert.equal(e.code,'40001');await cs[i].query('ROLLBACK');statuses[i]='aborted';}
  step='commit';for(let i=0;i<2;i++)if(!statuses[i])try{await cs[i].query('COMMIT');statuses[i]='committed';}catch(e){codes.push({client:i,stage:step,sqlstate:e.code});assert.equal(e.code,'40001');await cs[i].query('ROLLBACK');statuses[i]='aborted';}
  evidence.cases.push({fixtureStudents:size,state,studentSpacing:students[1]-students[0],phase,writeMode,repeat,statuses,codes,locks,pool:{total:observer.totalCount,idle:observer.idleCount,waiting:observer.waitingCount}});
 }finally{for(let i=0;i<2;i++){await clients[i].query('ROLLBACK');cs[i].release();evidence.trace.push(wrappers[i].summary());}}
}
try{
 evidence.postgres=(await observer.query('SHOW server_version')).rows[0].server_version;
 for(const [id,kind,data] of [['rc-course','course',{status:'published',title:'Fixture'}],['rc-exam','exam',{status:'published',courseId:'rc-course',questionIds:[]}]] )await observer.query('INSERT INTO farmakon.records VALUES($1,$2,$3,$4,$5)',[id,kind,'rc-course',JSON.stringify(data),now]);
 for(const size of (process.env.FARMAKON_TRACE_LARGE_ONLY==='true'?[1200]:[8,1200])){
  await seed(size,process.env.FARMAKON_TRACE_LARGE_ONLY==='true'||size===8?0:8);await observer.query('ANALYZE farmakon.records');
  for(const [phase,[sql,args]] of Object.entries(reads)){if(phase==='member-upsert')continue;const p=await observer.query('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) '+sql,args(0));evidence.plans.push({fixtureStudents:size,phase,plan:p.rows[0]['QUERY PLAN'][0]});}
  for(const phase of Object.keys(reads))for(const mode of (phase==='activity-read'?['activity']:['upsert','update']))for(let repeat=0;repeat<2;repeat++)await pair(size,phase,mode,repeat);
  // Distinguish missing fixture statistics from an application query/index issue.
  await observer.query('ANALYZE farmakon.activity');const [sql,args]=reads['activity-read'];evidence.plans.push({fixtureStudents:size,phase:'activity-after-analyze',plan:(await observer.query('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) '+sql,args(0))).rows[0]['QUERY PLAN'][0]});
  for(let repeat=0;repeat<2;repeat++)await pair(size,'activity-read','activity',repeat,'after-analyze');
  if(size===1200)for(const phase of ['activity-read','active-attempt-read'])for(let repeat=0;repeat<2;repeat++)await pair(size,phase,phase==='activity-read'?'activity':'upsert',repeat,'spaced-keys',[0,600]);
 }
 evidence.rows={students:1200,attempts:3600,progress:3600,concurrentClients:2};console.log(JSON.stringify(evidence));
 fs.mkdirSync('docs/evidence',{recursive:true});fs.writeFileSync('docs/evidence/F00.10.3-COMPONENT-TRACE.json',JSON.stringify(evidence,null,2));
}finally{await observer.end();await close();console.log('CLEANUP root-cause component schema and pools removed');}
