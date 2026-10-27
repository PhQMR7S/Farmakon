// Real isolated PostgreSQL + actual adapter/routes. Auth and rate-limit transport are fixtures.
import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
import {AsyncLocalStorage} from 'node:async_hooks';
import {Pool} from 'pg';
import {testDatabase} from './helpers/postgres.mjs';

const {db:base,close,stats}=await testDatabase();
const observer=new Pool({connectionString:process.env.FARMAKON_TEST_DATABASE_URL,max:3,ssl:false});
const scope=new AsyncLocalStorage(),evidence={scope:'isolated real PostgreSQL/production adapter and routes; synthetic identities; Auth/rate transport fixtures; not Production',rounds:[],controlled:[],plans:[],locks:[]};
const db={transaction:fn=>base.transaction(async()=>{const c=scope.getStore();if(c)c.attempts++;return fn();}),batch:s=>base.batch(s),prepare(sql){const statement=base.prepare(sql);let args=[];const out={bind(...a){args=a;statement.bind(...a);return out;}};for(const method of ['first','all','run'])out[method]=async()=>{const c=scope.getStore();if(c?.hook)await c.hook({sql,args,method,before:true});try{const r=await statement[method]();if(c?.hook)await c.hook({sql,args,method,result:r,before:false});return r;}catch(e){if(c)c.codes.push(e.code||'OTHER');throw e;}};return out;}};
globalThis.__examConcurrency={db,user:()=>scope.getStore()?.user};process.env.FARMAKON_OWNER_EMAIL='owner@example.test';
const compile=s=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText).toString('base64');
const server=compile(fs.readFileSync('app/lib/server.ts','utf8').replace(/^import .*;$/gm,'').replace('export const db=()=>database;','export const db=()=>globalThis.__examConcurrency.db;').replace('export const bucket=()=>storage;','export const bucket=()=>({});').replace(/export async function identity\(\)\{.*?\nexport async function owner/s,'export async function identity(){return globalThis.__examConcurrency.user();}\nexport async function owner'));
const route=await import(compile(fs.readFileSync('app/api/platform/route.ts','utf8').replace("'../../lib/server'",JSON.stringify(server)).replace("'../../../lib/http'",JSON.stringify(compile(fs.readFileSync('lib/http.ts','utf8')))).replace("'../../../lib/farmakon/rate-limit'",JSON.stringify(compile('export async function limitRequest(){return null;}'))).replace("'zod'",JSON.stringify(import.meta.resolve('zod')))));
const student=i=>({userId:'concurrency-'+i,email:`concurrency-${i}@example.test`,displayName:'Synthetic '+i});
function barrier(n,onReady=async()=>{}){let count=0,release,reject;const gate=new Promise((a,b)=>{release=a;reject=b;});const timer=setTimeout(()=>reject(Error('BARRIER_TIMEOUT')),10000);return async()=>{if(++count===n){try{await onReady();release();}catch(e){reject(e);}finally{clearTimeout(timer);}}await gate;};}
async function call(i,body,hook){const c={user:student(i),attempts:0,codes:[],hook};return scope.run(c,async()=>{const response=await route.POST(new Request('https://synthetic.test/api/platform',{method:'POST',headers:{origin:'https://synthetic.test','content-type':'application/json'},body:JSON.stringify(body)}));return {status:response.status,data:await response.json(),attempts:c.attempts,codes:c.codes};});}
const start=(i,hook)=>call(i,{action:'startExam',id:'exam'},hook);
const save=(i,id,answers,hook)=>call(i,{action:'saveExam',id,answers},hook);
const submit=(i,id,hook)=>call(i,{action:'submitExam',id,answers:{}},hook);
const record=async(id,data,kind='attempt')=>observer.query('INSERT INTO farmakon.records VALUES($1,$2,$3,$4,$5)',[id,kind,'course',JSON.stringify(data),Date.now()]);
const read=async id=>JSON.parse((await observer.query('SELECT data FROM farmakon.records WHERE id=$1',[id])).rows[0].data);
function ok(r){assert.equal(r.status,200,JSON.stringify({status:r.status,codes:r.codes}));return r.data;}
async function healthy(){assert.equal((await base.prepare('SELECT 1 AS n').first()).n,1);assert.equal(stats().waiting,0);assert.equal(stats().idle,stats().total);}
const beforeMember=gate=>{let used=false;return async e=>{if(!used&&e.before&&e.sql.startsWith('INSERT INTO members')){used=true;await gate();}};};
const beforeAttemptWrite=gate=>{let used=false;return async e=>{if(!used&&e.before&&e.sql.startsWith('INSERT INTO records')&&e.args[1]==='attempt'){used=true;await gate();}};};
try{
 evidence.postgres=(await observer.query('SHOW server_version')).rows[0].server_version;
 await record('course',{title:'Synthetic',status:'published'},'course');
 await record('q1',{title:'Q1',status:'published',courseId:'course',options:['a','b','c','d'],correct:1,explanation:'fixture'},'question');
 await record('q2',{title:'Q2',status:'published',courseId:'course',options:['a','b','c','d'],correct:2,explanation:'fixture'},'question');
 await record('exam',{title:'Synthetic exam',status:'published',courseId:'course',minutes:20,questionIds:['q1','q2']},'exam');
 for(let i=0;i<40;i++){const u=student(i);await observer.query('INSERT INTO farmakon.members VALUES($1,$2,$3,$4)',[u.userId,u.email,u.displayName,Date.now()]);await observer.query('INSERT INTO farmakon.enrollments VALUES($1,$2,$3,$4,$5)',['en-'+i,u.email,'course',Date.now()+86400000,'synthetic']);}
 await observer.query('ANALYZE farmakon.records');
 const plan=await observer.query("EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT * FROM farmakon.records WHERE kind='attempt' AND data::jsonb->>'userId'='concurrency-1' AND data::jsonb->>'status'='active' ORDER BY created DESC,id DESC");evidence.plans.push(plan.rows[0]['QUERY PLAN'][0]);
 for(let round=0;round<3;round++){
  // Both devices enter before the member UPSERT; never hold its row lock at a barrier.
  const i=round*10,gate=barrier(2);const pair=await Promise.all([start(i,beforeMember(gate)),start(i,beforeMember(gate))]);const id=ok(pair[0]).id;assert.equal(ok(pair[1]).id,id);
  const active=await observer.query("SELECT count(*)::int n FROM farmakon.records WHERE kind='attempt' AND data::jsonb->>'userId'=$1 AND data::jsonb->>'status'='active'",[student(i).userId]);assert.equal(active.rows[0].n,1);
  const patches=await Promise.all([save(i,id,{q1:1}),save(i,id,{q2:2})]);patches.forEach(ok);assert.deepEqual((await read(id)).answers,{q1:1,q2:2});
  const finished=await Promise.all([submit(i,id),submit(i,id)]);finished.forEach(r=>assert.equal(ok(r).score,2));assert.deepEqual(finished[0].data,finished[1].data);assert.equal((await observer.query("SELECT count(*)::int n FROM farmakon.activity WHERE target=$1 AND kind='exam'",[id])).rows[0].n,1);
  // Different students read their own empty predicates before either inserts.
  const crossGate=barrier(2,async()=>{evidence.locks.push((await observer.query("SELECT locktype,mode,relation::regclass::text relation,page,tuple FROM pg_locks WHERE mode='SIReadLock' AND relation='farmakon.records'::regclass")).rows);});
  const cross=await Promise.all([start(i+1,beforeAttemptWrite(crossGate)),start(i+2,beforeAttemptWrite(crossGate))]);cross.forEach(ok);assert.notEqual(cross[0].data.id,cross[1].data.id);
  assert.equal((await save(i+1,cross[1].data.id,{q1:1})).status,409);assert.equal((await submit(i+1,cross[1].data.id)).status,404);
  // Start versus another student's save and settlement; coordinate before writes.
  let g=barrier(2);const saveRace=await Promise.all([start(i+3,beforeAttemptWrite(g)),save(i+1,cross[0].data.id,{q1:1},beforeAttemptWrite(g))]);saveRace.forEach(ok);assert.equal((await read(cross[0].data.id)).answers.q1,1);
  g=barrier(2);const settleRace=await Promise.all([start(i+4,beforeAttemptWrite(g)),submit(i+1,cross[0].data.id,beforeAttemptWrite(g))]);settleRace.forEach(ok);assert.equal(settleRace[1].data.score,1);
  // Establish a SERIALIZABLE snapshot, commit an external member edit, then UPSERT.
  let edited=false;const edit=await start(i+5,async e=>{if(!edited&&e.before&&e.sql.startsWith('INSERT INTO members')){edited=true;await base.prepare('SELECT 1 AS snapshot').first();await observer.query('UPDATE farmakon.members SET name=$1 WHERE id=$2',['Changed synthetic name',student(i+5).userId]);}});ok(edit);assert.ok(edit.attempts>=2,'member change must trigger a real snapshot conflict/retry');
  // Existing expired v2 attempt: concurrent resume and submit settle once, no new deadline.
  const expiredId='expired-'+round,expired={...(await read(cross[1].data.id)),userId:student(i+6).userId,answers:{q1:1,q2:2},deadline:Date.now()-1000,status:'active',timingVersion:2};await record(expiredId,expired);
  const expiryGate=barrier(2);const expiry=await Promise.all([start(i+6,beforeMember(expiryGate)),call(i+6,{action:'submitExam',id:expiredId,answers:{q1:0}},beforeMember(expiryGate))]);expiry.forEach(ok);const settled=await read(expiredId);assert.equal(settled.status,'done');assert.equal(settled.deadline,expired.deadline);assert.equal(settled.result.score,2);assert.equal((await observer.query("SELECT count(*)::int n FROM farmakon.activity WHERE target=$1 AND kind='exam'",[expiredId])).rows[0].n,1);
  await healthy();evidence.rounds.push({round:round+1,sameStudent:pair.map(({status,attempts,codes})=>({status,attempts,codes})),differentStudents:cross.map(({status,attempts,codes})=>({status,attempts,codes})),saveRace:saveRace.map(({status,attempts,codes})=>({status,attempts,codes})),settleRace:settleRace.map(({status,attempts,codes})=>({status,attempts,codes})),expiredSettlement:expiry.map(({status,attempts,codes})=>({status,attempts,codes})),memberEdit:{status:edit.status,attempts:edit.attempts,codes:edit.codes},answersIntact:true,singleActive:true,singleResult:true,crossStudentDenied:true,pool:stats()});
 }
 // Deterministic SSI write skew: no server exception injection; failure at actual COMMIT.
 await observer.query('CREATE TABLE farmakon.concurrency_probe(id int PRIMARY KEY,value int NOT NULL)');await observer.query('INSERT INTO farmakon.concurrency_probe VALUES(1,0),(2,0)');
 const a=await observer.connect(),b=await observer.connect();try{await a.query('BEGIN ISOLATION LEVEL SERIALIZABLE');await b.query('BEGIN ISOLATION LEVEL SERIALIZABLE');await a.query('SELECT * FROM farmakon.concurrency_probe');await b.query('SELECT * FROM farmakon.concurrency_probe');await a.query('UPDATE farmakon.concurrency_probe SET value=1 WHERE id=1');await b.query('UPDATE farmakon.concurrency_probe SET value=1 WHERE id=2');await a.query('COMMIT');await assert.rejects(()=>b.query('COMMIT'),e=>e.code==='40001');await b.query('ROLLBACK');assert.equal((await observer.query('SELECT sum(value)::int n FROM farmakon.concurrency_probe')).rows[0].n,1);evidence.controlled.push({scenario:'real SSI COMMIT conflict',sqlstate:'40001',rolledBack:true});}finally{await a.query('ROLLBACK');await b.query('ROLLBACK');a.release();b.release();}
 // Real server-raised 40001 fault injection proves exhaustion, rollback and HTTP mapping.
 const exhausted=await start(39,async e=>{if(e.before&&e.sql.startsWith('INSERT INTO records')&&e.args[1]==='attempt'){await base.prepare("INSERT INTO farmakon.concurrency_probe VALUES(99,99)").run();await base.prepare("DO $$ BEGIN RAISE EXCEPTION 'controlled test serialization failure' USING ERRCODE='40001'; END $$").run();}});
 assert.equal(exhausted.status,503);assert.equal(exhausted.attempts,5);assert.equal((await observer.query('SELECT count(*)::int n FROM farmakon.concurrency_probe WHERE id=99')).rows[0].n,0);assert.equal((await observer.query("SELECT count(*)::int n FROM farmakon.records WHERE kind='attempt' AND data::jsonb->>'userId'=$1",[student(39).userId])).rows[0].n,0);await healthy();
 evidence.controlled.push({scenario:'server fault injection on every attempt; not organic load',httpStatus:exhausted.status,attempts:exhausted.attempts,rollback:true,pool:stats()});
 // One real SSI COMMIT failure through the production retry adapter, then success.
 let work=0;await base.transaction(async()=>{work++;await base.prepare('SELECT * FROM farmakon.concurrency_probe').all();if(work===1){const peer=await observer.connect();try{await peer.query('BEGIN ISOLATION LEVEL SERIALIZABLE');await peer.query('SELECT * FROM farmakon.concurrency_probe');await peer.query('UPDATE farmakon.concurrency_probe SET value=value+1 WHERE id=1');await base.prepare('UPDATE farmakon.concurrency_probe SET value=value+1 WHERE id=2').run();await peer.query('COMMIT');}finally{peer.release();}}else await base.prepare('UPDATE farmakon.concurrency_probe SET value=value+1 WHERE id=2').run();});assert.equal(work,2);await healthy();evidence.controlled.push({scenario:'adapter retries actual SSI COMMIT failure',attempts:work,pool:stats()});
 evidence.verdict='PASS within bounded diagnostic scope; historical conflicting pair not identified';console.log(JSON.stringify(evidence));
}finally{await observer.end();await close();delete globalThis.__examConcurrency;console.log('CLEANUP isolated schema and pools closed');}
