// Test-only layout comparison. Never used by application runtime.
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {Pool} from 'pg';
import {testDatabase} from './helpers/postgres.mjs';
const {close}=await testDatabase();
const pool=new Pool({connectionString:process.env.FARMAKON_TEST_DATABASE_URL,max:3,ssl:false});
const variants=[['a',0],['b1',0],['b2',4],['b3',8],['b4',32]];
const name=i=>'p02-user-'+String(i).padStart(4,'0');
const result={scope:'synthetic two-client SQL component; not HTTP and not runtime adapter',students:1200,clients:2,variants:{},cases:[],plans:{},cost:{}};
const read=v=>v==='a'?"SELECT * FROM farmakon.records WHERE kind='attempt' AND data::jsonb->>'userId'=$1 AND data::jsonb->>'status'='active' ORDER BY created DESC,id DESC":`SELECT * FROM farmakon.${v}_attempts WHERE user_id=$1 AND status='active' ORDER BY created DESC,id DESC`;
const fresh=i=>(i>=40&&i<80)||(i>=100&&i<120)||(i>=700&&i<720);
function pairIDs(dist,mode,n){const start=mode==='start';return dist==='adjacent'?[n*2+(start?40:0),n*2+1+(start?40:0)]:[n+(start?100:80),n+(start?700:680)];}
async function mutation(c,v,mode,i,round,dist){
 const attempt=v+'-attempt-'+i,data=JSON.stringify({userId:name(i),examId:'exam',status:mode==='start'?'active':'done',answers:{q:1},result:mode==='start'?null:{score:1,total:1},deadline:1800000000000});
 if(mode==='start'){
  if(v==='a')await c.query('INSERT INTO farmakon.records VALUES($1,$2,$3,$4,$5)',[v+'-new-'+i,'attempt','course',data,Date.now()]);
  else await c.query(`INSERT INTO farmakon.${v}_attempts VALUES($1,$2,$3,$4,$5,$6)`,[name(i),v+'-new-'+i,'exam','active',data,Date.now()]);
 }else if(v==='a'){
  await c.query('UPDATE farmakon.records SET data=$1 WHERE id=$2',[data,attempt]);
  await c.query("INSERT INTO farmakon.activity VALUES($1,$2,'exam',$3,$4,$5) ON CONFLICT(user_id,kind,target) DO NOTHING",[v+'-event-'+dist+'-'+round+'-'+i,name(i),attempt,'{}',Date.now()]);
 }else{
  await c.query(`UPDATE farmakon.${v}_attempts SET status='done',data=$1 WHERE user_id=$2 AND id=$3`,[data,name(i),attempt]);
  await c.query(`INSERT INTO farmakon.${v}_results VALUES($1,$2,$3,$4) ON CONFLICT(user_id,attempt_id) DO NOTHING`,[name(i),attempt,'{}',Date.now()]);
 }
}
async function pair(v,mode,dist,n){
 const ids=pairIDs(dist,mode,n),cs=[await pool.connect(),await pool.connect()],fail=[],locks=[],ms=[],status=[];
 try{
  for(const c of cs)await c.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
  for(let j=0;j<2;j++)assert.equal((await cs[j].query(read(v),[name(ids[j])])).rowCount,mode==='start'?0:1);
  for(const c of cs)locks.push((await pool.query("SELECT locktype,relation::regclass::text relation,page,tuple FROM pg_locks WHERE pid=$1 AND mode='SIReadLock' ORDER BY relation,page,tuple",[c.processID])).rows);
  for(let j=0;j<2;j++)try{const t=performance.now();await mutation(cs[j],v,mode,ids[j],n,dist);ms[j]=performance.now()-t;}catch(e){if(e.code!=='40001')throw e;fail.push({phase:'write',sqlstate:e.code});await cs[j].query('ROLLBACK');status[j]='aborted';}
  for(let j=0;j<2;j++)if(!status[j])try{const t=performance.now();await cs[j].query('COMMIT');ms[j]+=performance.now()-t;status[j]='committed';}catch(e){if(e.code!=='40001')throw e;fail.push({phase:'commit',sqlstate:e.code});await cs[j].query('ROLLBACK');status[j]='aborted';}
  for(let j=0;j<2;j++)if(status[j]==='aborted'){await cs[j].query('BEGIN ISOLATION LEVEL SERIALIZABLE');assert.equal((await cs[j].query(read(v),[name(ids[j])])).rowCount,mode==='start'?0:1);await mutation(cs[j],v,mode,ids[j],n,dist);await cs[j].query('COMMIT');}
  for(const i of ids){if(mode==='start')assert.equal((await pool.query(read(v),[name(i)])).rowCount,1);else {const q=v==='a'?await pool.query("SELECT count(*)::int n FROM farmakon.activity WHERE user_id=$1 AND target=$2 AND kind='exam'",[name(i),v+'-attempt-'+i]):await pool.query(`SELECT count(*)::int n FROM farmakon.${v}_results WHERE user_id=$1 AND attempt_id=$2`,[name(i),v+'-attempt-'+i]);assert.equal(q.rows[0].n,1);}}
  result.cases.push({variant:v,mode,distribution:dist,round:n,status,failures:fail,retries:fail.length,writeCommitMs:ms.map(x=>x===undefined?null:Number(x.toFixed(3))),locks});
 }finally{for(const c of cs){await c.query('ROLLBACK').catch(()=>{});c.release();}}
}
try{
 result.postgres=(await pool.query('SHOW server_version')).rows[0].server_version;
 for(const [v,p] of variants.filter(x=>x[0]!=='a')){
  const partition=p?' PARTITION BY HASH(user_id)':'';
  await pool.query(`CREATE TABLE farmakon.${v}_attempts(user_id text NOT NULL,id text NOT NULL,exam_id text NOT NULL,status text NOT NULL,data text NOT NULL,created bigint NOT NULL,PRIMARY KEY(user_id,id))${partition}`);
  await pool.query(`CREATE TABLE farmakon.${v}_results(user_id text NOT NULL,attempt_id text NOT NULL,data text NOT NULL,updated bigint NOT NULL,PRIMARY KEY(user_id,attempt_id))${partition}`);
  for(let n=0;n<p;n++)for(const t of ['attempts','results'])await pool.query(`CREATE TABLE farmakon.${v}_${t}_p${n} PARTITION OF farmakon.${v}_${t} FOR VALUES WITH (MODULUS ${p},REMAINDER ${n})`);
  await pool.query(`CREATE UNIQUE INDEX ${v}_active_unique ON farmakon.${v}_attempts(user_id,exam_id) WHERE status='active'`);
  await pool.query(`CREATE INDEX ${v}_read ON farmakon.${v}_attempts(user_id,status,created DESC,id DESC)`);
 }
 const now=Date.now();await pool.query('BEGIN');
 for(let i=0;i<1200;i++){
  const status=fresh(i)?'done':'active',data=JSON.stringify({userId:name(i),examId:'exam',status,answers:{q:1},questions:[{id:'q',correct:1}],deadline:1800000000000});
  await pool.query('INSERT INTO farmakon.members VALUES($1,$2,$3,$4)',[name(i),name(i)+'@example.test','Synthetic',now]);
  await pool.query('INSERT INTO farmakon.records VALUES($1,$2,$3,$4,$5)',['a-attempt-'+i,'attempt','course',data,now]);
  for(const [v] of variants.filter(x=>x[0]!=='a'))await pool.query(`INSERT INTO farmakon.${v}_attempts VALUES($1,$2,$3,$4,$5,$6)`,[name(i),v+'-attempt-'+i,'exam',status,data,now]);
 }
 await pool.query('COMMIT');await pool.query('ANALYZE farmakon.records');await pool.query('ANALYZE farmakon.activity');
 for(const [v] of variants.filter(x=>x[0]!=='a')){await pool.query(`ANALYZE farmakon.${v}_attempts`);await pool.query(`ANALYZE farmakon.${v}_results`);}
 for(const [v] of variants){result.plans[v]=(await pool.query('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) '+read(v),[name(0)])).rows[0]['QUERY PLAN'][0];}
 for(const dist of ['adjacent','spaced'])for(const mode of ['submit','start'])for(let n=0;n<20;n++)for(const [v] of variants)await pair(v,mode,dist,n);
 for(const [v,p] of variants){const cases=result.cases.filter(x=>x.variant===v);result.variants[v]={partitions:p||1,pairs:cases.length,transactions:cases.length*2,aborts:cases.reduce((s,c)=>s+c.failures.length,0),retries:cases.reduce((s,c)=>s+c.retries,0)};}
 for(const [v] of variants){const table=v==='a'?'records':v+'_attempts',q=await pool.query("SELECT count(*)::int AS relations,coalesce(sum(pg_total_relation_size(oid)),0)::bigint AS bytes FROM pg_class WHERE relnamespace='farmakon'::regnamespace AND (relname=$1 OR relname LIKE $2) AND relkind='r'",[table,table+'_p%']);result.cost[v]=q.rows[0];}
 console.log(JSON.stringify(result));
}finally{await pool.query('ROLLBACK').catch(()=>{});await pool.end();await close();console.log('CLEANUP isolated schema and pools');}

