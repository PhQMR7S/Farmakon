// Isolated design experiment; not application code or a migration.
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {Pool} from 'pg';
import {testDatabase} from './helpers/postgres.mjs';
const {close}=await testDatabase();
const pool=new Pool({connectionString:process.env.FARMAKON_TEST_DATABASE_URL,max:3,ssl:false});
const uid=i=>'ab-student-'+String(i).padStart(4,'0');
const result={scope:'isolated PostgreSQL component experiment; synthetic data, two concurrent transactions, no HTTP or provider',students:1200,clients:2,layouts:{},cases:[],plans:{}};
const statement={
 A:{read:"SELECT * FROM farmakon.records WHERE kind='attempt' AND data::jsonb->>'userId'=$1 AND data::jsonb->>'status'='active' ORDER BY created DESC,id DESC",update:"UPDATE farmakon.records SET data=$1 WHERE id=$2",event:"INSERT INTO farmakon.activity VALUES($1,$2,'exam',$3,$4,$5) ON CONFLICT(user_id,kind,target) DO NOTHING"},
 B:{read:"SELECT * FROM farmakon.ab_attempts WHERE user_id=$1 AND status='active' ORDER BY created DESC,id DESC",update:"UPDATE farmakon.ab_attempts SET data=$1,status='done' WHERE user_id=$2 AND id=$3",event:"INSERT INTO farmakon.ab_results(user_id,attempt_id,data,updated) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,attempt_id) DO NOTHING"}
};
async function plan(name){const q=await pool.query('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) '+statement[name].read,[uid(0)]);result.plans[name]=q.rows[0]['QUERY PLAN'][0];}
async function insertResult(c,layout,i,round){const at='ab-at-'+i, event='ab-event-'+layout+'-'+round+'-'+i, data=JSON.stringify({score:1,total:1});if(layout==='A')await c.query(statement.A.event,[event,uid(i),at,data,Date.now()]);else await c.query(statement.B.event,[uid(i),at,data,Date.now()]);}
async function update(c,layout,i){const at='ab-at-'+i, data=JSON.stringify({userId:uid(i),examId:'ab-exam',status:'done',answers:{q:1},result:{score:1,total:1}});if(layout==='A')await c.query(statement.A.update,[data,at]);else await c.query(statement.B.update,[data,uid(i),at]);}
async function start(c,layout,i,suffix=''){const id='ab-new-'+i+suffix,data=JSON.stringify({userId:uid(i),examId:'ab-exam',status:'active',answers:{},questions:[{id:'q',correct:1}]});if(layout==='A')await c.query('INSERT INTO farmakon.records VALUES($1,$2,$3,$4,$5)',[id,'attempt','ab-course',data,Date.now()]);else await c.query('INSERT INTO farmakon.ab_attempts VALUES($1,$2,$3,$4,$5,$6)',[uid(i),id,'ab-exam','active',data,Date.now()]);}
async function sameStudent(layout,i){
 const a=await pool.connect(),b=await pool.connect();let code;
 try{
  await a.query('BEGIN ISOLATION LEVEL SERIALIZABLE');await b.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
  assert.equal((await a.query(statement[layout].read,[uid(i)])).rowCount,0);assert.equal((await b.query(statement[layout].read,[uid(i)])).rowCount,0);
  await start(a,layout,i,'-device-a');await a.query('COMMIT');
  try{await start(b,layout,i,'-device-b');await b.query('COMMIT');}catch(e){code=e.code;await b.query('ROLLBACK');}
  assert.ok(['40001','23505'].includes(code),'concurrent same-student creation must abort');
  assert.equal((await pool.query(statement[layout].read,[uid(i)])).rowCount,1);
  result.cases.push({layout,mode:'same-student-start',sqlstate:code,activeCount:1});
 }finally{await a.query('ROLLBACK').catch(()=>{});await b.query('ROLLBACK').catch(()=>{});a.release();b.release();}
}
async function pair(layout,round,mode='submit'){
 const ids=[round*2+(mode==='start'?40:0),round*2+1+(mode==='start'?40:0)], cs=[await pool.connect(),await pool.connect()], statuses=[], locks=[], times=[], failures=[];
 try{
  for(const c of cs)await c.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
  for(let n=0;n<2;n++){const q=await cs[n].query(statement[layout].read,[uid(ids[n])]);assert.equal(q.rowCount,mode==='start'?0:1,'fixture active attempt count');}
  for(const c of cs)locks.push((await pool.query("SELECT locktype,relation::regclass::text AS relation,page,tuple FROM pg_locks WHERE pid=$1 AND mode='SIReadLock' ORDER BY relation,page,tuple",[c.processID])).rows);
  for(let n=0;n<2;n++){try{if(mode==='start')await start(cs[n],layout,ids[n]);else{await update(cs[n],layout,ids[n]);await insertResult(cs[n],layout,ids[n],round);}}catch(e){if(e.code!=='40001')throw e;failures.push({client:n,phase:'write',sqlstate:e.code});await cs[n].query('ROLLBACK');statuses[n]='aborted';}}
  for(let n=0;n<2;n++)if(!statuses[n]){const start=performance.now();try{await cs[n].query('COMMIT');statuses[n]='committed';}catch(e){if(e.code!=='40001')throw e;failures.push({client:n,phase:'commit',sqlstate:e.code});await cs[n].query('ROLLBACK');statuses[n]='aborted';}times[n]=Number((performance.now()-start).toFixed(3));}
  let retries=0;
  for(let n=0;n<2;n++)if(statuses[n]==='aborted'){retries++;await cs[n].query('BEGIN ISOLATION LEVEL SERIALIZABLE');const q=await cs[n].query(statement[layout].read,[uid(ids[n])]);assert.equal(q.rowCount,mode==='start'?0:1);if(mode==='start')await start(cs[n],layout,ids[n]);else{await update(cs[n],layout,ids[n]);await insertResult(cs[n],layout,ids[n],round);}await cs[n].query('COMMIT');}
  if(mode==='submit')for(let n=0;n<2;n++){const count=layout==='A'?await pool.query("SELECT count(*)::int n FROM farmakon.activity WHERE user_id=$1 AND target=$2 AND kind='exam'",[uid(ids[n]),'ab-at-'+ids[n]]):await pool.query('SELECT count(*)::int n FROM farmakon.ab_results WHERE user_id=$1 AND attempt_id=$2',[uid(ids[n]),'ab-at-'+ids[n]]);assert.equal(count.rows[0].n,1);}
  if(mode==='start')for(const i of ids){const q=await pool.query(statement[layout].read,[uid(i)]);assert.equal(q.rowCount,1,'start must create one active attempt');}
  result.cases.push({layout,mode,round,statuses,failures,retries,commitMs:times,locks,resultEvents:mode==='submit'?2:0});
 }finally{for(const c of cs){await c.query('ROLLBACK').catch(()=>{});c.release();}}
}
try{
 result.postgres=(await pool.query('SHOW server_version')).rows[0].server_version;
 await pool.query("CREATE TABLE farmakon.ab_attempts(user_id text NOT NULL,id text NOT NULL,exam_id text NOT NULL,status text NOT NULL,data text NOT NULL,created bigint NOT NULL,PRIMARY KEY(user_id,id)) PARTITION BY HASH(user_id)");
 for(let i=0;i<32;i++)await pool.query('CREATE TABLE farmakon.ab_attempts_p'+i+' PARTITION OF farmakon.ab_attempts FOR VALUES WITH (MODULUS 32, REMAINDER '+i+')');
 await pool.query("CREATE UNIQUE INDEX ab_one_active ON farmakon.ab_attempts(user_id,exam_id) WHERE status='active'");
 await pool.query('CREATE INDEX ab_active_read ON farmakon.ab_attempts(user_id,status,created DESC,id DESC)');
 await pool.query('CREATE TABLE farmakon.ab_results(user_id text NOT NULL,attempt_id text NOT NULL,data text NOT NULL,updated bigint NOT NULL,PRIMARY KEY(user_id,attempt_id)) PARTITION BY HASH(user_id)');
 for(let i=0;i<32;i++)await pool.query('CREATE TABLE farmakon.ab_results_p'+i+' PARTITION OF farmakon.ab_results FOR VALUES WITH (MODULUS 32, REMAINDER '+i+')');
 const now=Date.now();await pool.query('BEGIN');
 for(let i=0;i<1200;i++){
  const data=JSON.stringify({userId:uid(i),examId:'ab-exam',status:'active',answers:{q:1},questions:[{id:'q',correct:1}]});
  await pool.query('INSERT INTO farmakon.members VALUES($1,$2,$3,$4)',[uid(i),uid(i)+'@example.test','Synthetic',now]);
  await pool.query('INSERT INTO farmakon.records VALUES($1,$2,$3,$4,$5)',['ab-at-'+i,'attempt','ab-course',data,now]);
  await pool.query('INSERT INTO farmakon.ab_attempts VALUES($1,$2,$3,$4,$5,$6)',[uid(i),'ab-at-'+i,'ab-exam','active',data,now]);
 }
 await pool.query('COMMIT');await pool.query('ANALYZE farmakon.records');await pool.query('ANALYZE farmakon.ab_attempts');await pool.query('ANALYZE farmakon.activity');await pool.query('ANALYZE farmakon.ab_results');
 for(let i=40;i<82;i++){const d=JSON.stringify({userId:uid(i),examId:'ab-exam',status:'done',result:{score:1}});await pool.query('UPDATE farmakon.records SET data=$1 WHERE id=$2',[d,'ab-at-'+i]);await pool.query("UPDATE farmakon.ab_attempts SET status='done',data=$1 WHERE user_id=$2 AND id=$3",[d,uid(i),'ab-at-'+i]);}
 await plan('A');await plan('B');
 // Interleave identical student pairs, operations, transaction ordering and event writes.
 for(const mode of ['submit','start'])for(let n=0;n<20;n++){await pair('A',n,mode);await pair('B',n,mode);}
 await sameStudent('A',80);await sameStudent('B',81);
 for(const layout of ['A','B'])for(const mode of ['submit','start']){const cases=result.cases.filter(c=>c.layout===layout&&c.mode===mode);result.layouts[layout+'-'+mode]={pairs:cases.length,transactions:cases.length*2,aborted:cases.flatMap(c=>c.failures).length,retries:cases.reduce((s,c)=>s+c.retries,0),confirmedEvents:cases.reduce((s,c)=>s+c.resultEvents,0)};}
 console.log(JSON.stringify(result));
}finally{await pool.query('ROLLBACK').catch(()=>{});await pool.end();await close();console.log('CLEANUP isolated farmakon schema and pools');}

