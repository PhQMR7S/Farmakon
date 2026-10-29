// P0.6: original platform/server handlers + production SQL adapter + P0.5 triggers.
// Auth identity and rate-limit transport are synthetic; no live providers.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {Pool} from 'pg';
import {AsyncLocalStorage} from 'node:async_hooks';
import {testDatabase} from './helpers/postgres.mjs';
const scope=new AsyncLocalStorage(),checks=[];
const ev={scope:'P0.6 original handlers with PostgreSQL atomic triggers',checks,ssiGate:'FAILED/OPEN; no HTTP load',result:'FAIL'};
const adminURL=process.env.FARMAKON_TEST_DATABASE_URL;
const {db,close}=await testDatabase();
const pool=new Pool({connectionString:adminURL,max:2,ssl:false});
function replaceOnce(s,from,to){assert.equal(s.split(from).length,2,'fixture contract changed');return s.replace(from,to);}
let ddl=fs.readFileSync('tests/fixtures/atomic-mirror-p05.sql','utf8');
ddl=replaceOnce(ddl,'CREATE SCHEMA p05 AUTHORIZATION p05_owner;','ALTER SCHEMA farmakon OWNER TO p05_owner;');
ddl=replaceOnce(ddl,"CREATE TABLE p05.records(id text PRIMARY KEY,kind text NOT NULL,course_id text NOT NULL DEFAULT '',data text NOT NULL,created bigint NOT NULL);",'');
ddl=replaceOnce(ddl,"CREATE TABLE p05.activity(id text PRIMARY KEY,user_id text NOT NULL,kind text NOT NULL,target text NOT NULL,data text NOT NULL,updated bigint NOT NULL,UNIQUE(user_id,kind,target));",'');
ddl=replaceOnce(ddl,'SET LOCAL ROLE p05_owner;',`ALTER TABLE farmakon.records OWNER TO p05_owner;
ALTER TABLE farmakon.activity OWNER TO p05_owner;
SET LOCAL ROLE p05_owner;`);
ddl=ddl.replaceAll('p05.','farmakon.').replaceAll('SCHEMA p05 ','SCHEMA farmakon ');
await pool.query(ddl);
for(const table of ['members','settings','enrollments','codes']){
 await pool.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON farmakon.${table} TO p05_writer; CREATE POLICY p06_writer ON farmakon.${table} TO p05_writer USING(true) WITH CHECK(true)`);
}
// The production adapter opens lazily: its first connection is a real restricted login.
const writerURL=new URL(adminURL);writerURL.username='p05_writer';writerURL.password='p05-fixture-only';
process.env.FARMAKON_TEST_DATABASE_URL=writerURL.href;
globalThis.__p02={db,user:()=>scope.getStore()};
const ok=name=>checks.push({name,status:'PASS'});
async function match(){
 for(const [source,target,kind] of [['records','attempt_shadow','attempt'],['activity','event_shadow','exam']]){
  const r=await pool.query(`SELECT count(*)::int n FROM ((SELECT * FROM farmakon.${source} WHERE kind='${kind}' EXCEPT SELECT * FROM farmakon.${target}) UNION ALL (SELECT * FROM farmakon.${target} EXCEPT SELECT * FROM farmakon.${source} WHERE kind='${kind}')) d`);
  assert.equal(r.rows[0].n,0);
 }
}
async function snapshot(){
 return (await pool.query("SELECT jsonb_build_array((SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM farmakon.records t),(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM farmakon.attempt_shadow t),(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM farmakon.activity t),(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM farmakon.event_shadow t),(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM farmakon.members t)) s")).rows[0].s;
}
async function fault(sql,work){
 await pool.query(sql);const before=await snapshot();
 try{await work();assert.deepEqual(await snapshot(),before);await match();}
 finally{await pool.query('ALTER TABLE farmakon.attempt_shadow DROP CONSTRAINT IF EXISTS p06_fault; ALTER TABLE farmakon.event_shadow DROP CONSTRAINT IF EXISTS p06_fault');}
}
process.env.FARMAKON_OWNER_EMAIL='owner@example.test';
const compile=s=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText).toString('base64');
const server=compile(fs.readFileSync('app/lib/server.ts','utf8').replace(/^import .*;$/gm,'').replace('export const db=()=>database;','export const db=()=>globalThis.__p02.db;').replace('export const bucket=()=>storage;','export const bucket=()=>({});').replace(/export async function identity\(\)\{.*?\nexport async function owner/s,'export async function identity(){return globalThis.__p02.user();}\nexport async function owner'));
const route=await import(compile(fs.readFileSync('app/api/platform/route.ts','utf8').replace("'../../lib/server'",JSON.stringify(server)).replace("'../../../lib/http'",JSON.stringify(compile(fs.readFileSync('lib/http.ts','utf8')))).replace("'../../../lib/farmakon/rate-limit'",JSON.stringify(compile('export async function limitRequest(){return null;}'))).replace("'zod'",JSON.stringify(import.meta.resolve('zod')))));
const owner={userId:'p02-owner',email:'owner@example.test',displayName:'Owner'},a={userId:'p02-a',email:'a@example.test',displayName:'A'},b={userId:'p02-b',email:'b@example.test',displayName:'B'};
async function post(u,body,status=200){return scope.run(u,async()=>{const r=await route.POST(new Request('https://synthetic.test/api/platform',{method:'POST',headers:{origin:'https://synthetic.test','content-type':'application/json'},body:JSON.stringify(body)}));const d=await r.json();if(status!==null)assert.equal(r.status,status,JSON.stringify({action:body.action,status:r.status}));return status===null?{status:r.status,data:d}:d;});}
async function get(u){return scope.run(u,async()=>{const r=await route.GET();assert.equal(r.status,200);return r.json();});}
try{
 const who=await db.prepare("SELECT current_user u,session_user s,(SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=current_user) unsafe").first();
 assert.equal(who.u,'p05_writer');assert.equal(who.s,'p05_writer');assert.equal(who.unsafe,false);ok('production SQL adapter uses restricted LOGIN');
 const course=await post(owner,{action:'save',kind:'course',data:{title:'Synthetic',description:'',stage:'3',category:'Pharmacy',price:1,days:30,status:'published',color:'teal'}});
 await post(owner,{action:'enroll',email:a.email,courseId:course.id,days:30});
 const qs=[];for(let i=0;i<2;i++)qs.push((await post(owner,{action:'save',kind:'question',data:{title:'Question '+i,courseId:course.id,topic:'',options:['a','b','c','d'],correct:i+1,explanation:'explanation',source:'source',status:'published',free:false}})).id);
 const exam=(await post(owner,{action:'save',kind:'exam',data:{title:'Exam',courseId:course.id,minutes:20,questionIds:qs,status:'published',free:false}})).id;
 const starts=await Promise.all([post(a,{action:'startExam',id:exam}),post(a,{action:'startExam',id:exam})]);assert.equal(starts[0].id,starts[1].id);const id=starts[0].id;await match();ok('concurrent original startExam creates one attempt');assert.equal(starts[0].questions[0].correct,undefined);
 await Promise.all([post(a,{action:'saveExam',id,answers:{[qs[0]]:1}}),post(a,{action:'saveExam',id,answers:{[qs[1]]:2}})]);
 const resumed=await post(a,{action:'startExam',id:exam});assert.deepEqual(resumed.answers,{[qs[0]]:1,[qs[1]]:2});await match();ok('concurrent save patches survive and resume unchanged');
 await post(b,{action:'saveExam',id,answers:{}},409);await post(b,{action:'submitExam',id,answers:{}},404);
 ok('cross-user save and submit denied');const done=await Promise.all([post(a,{action:'submitExam',id,answers:{}}),post(a,{action:'submitExam',id,answers:{}})]);assert.equal(done[0].score,2);assert.deepEqual(done[0],done[1]);await match();ok('concurrent submit returns identical grade');
 await post(a,{action:'saveExam',id,answers:{}},409);assert.equal((await pool.query("SELECT count(*)::int n FROM farmakon.activity WHERE kind='exam' AND target=$1",[id])).rows[0].n,1);
 ok('done rejects save and has one result event');const racing=await post(a,{action:'startExam',id:exam});const raced=await Promise.all([post(a,{action:'saveExam',id:racing.id,answers:{[qs[0]]:1}},null),post(a,{action:'submitExam',id:racing.id,answers:{}},null)]);assert.ok([200,409].includes(raced[0].status));assert.equal(raced[1].status,200);if(raced[0].status===200)assert.equal(raced[1].data.score,1);await post(a,{action:'saveExam',id:racing.id,answers:{}},409);
 await match();ok('save versus submit preserves accepted answers and final state');
 // A legacy snapshot copied intact to the prototype keeps the existing grace policy.
 const legacyId='legacy-attempt',legacy={id:legacyId,userId:a.userId,examId:exam,courseId:course.id,status:'active',deadline:Date.now()-1000,questions:[{id:qs[0],correct:1,options:['a','b','c','d'],explanation:'fixture'}],answers:{}};
 await pool.query('INSERT INTO farmakon.records VALUES($1,$2,$3,$4,$5)',[legacyId,'attempt',course.id,JSON.stringify(legacy),Date.now()]);const legacyResult=await post(a,{action:'submitExam',id:legacyId,answers:{[qs[0]]:1}});assert.equal(legacyResult.score,1);await match();ok('legacy grace unchanged');
 const exp=await post(a,{action:'startExam',id:exam});const stored=(await pool.query('SELECT data FROM farmakon.records WHERE id=$1',[exp.id])).rows[0];const data=JSON.parse(stored.data);data.deadline=Date.now()-1000;await pool.query('UPDATE farmakon.records SET data=$1 WHERE id=$2',[JSON.stringify(data),exp.id]);await post(a,{action:'saveExam',id:exp.id,answers:{[qs[0]]:1}},409);const settled=await post(a,{action:'submitExam',id:exp.id,answers:{[qs[0]]:1}});assert.equal(settled.score,0);await match();ok('v2 deadline rejects late answers');
 const active=await post(a,{action:'startExam',id:exam});const en=(await pool.query('SELECT id FROM farmakon.enrollments WHERE email=$1',[a.email])).rows[0];await pool.query('UPDATE farmakon.enrollments SET expires=$1 WHERE id=$2',[Date.now()-1,en.id]);await post(a,{action:'saveExam',id:active.id,answers:{}},403);await post(owner,{action:'enroll',email:a.email,courseId:course.id,days:30});await post(owner,{action:'revoke',id:en.id});assert.equal((await get(a)).attempts.length,0);await post(a,{action:'saveExam',id:active.id,answers:{}},403);await post(a,{action:'submitExam',id:active.id,answers:{}},403);

 await match();ok('expired and revoked subscription deny original handlers');
 // Restore only synthetic entitlement to exercise the same original routes.
 await post(owner,{action:'enroll',email:a.email,courseId:course.id,days:30});
 await post(a,{action:'submitExam',id:active.id,answers:{}});
 // Transaction failures are injected in the shadow, never in application code.
 await fault("ALTER TABLE farmakon.attempt_shadow ADD CONSTRAINT p06_fault CHECK(false) NOT VALID",async()=>{
  await post(a,{action:'startExam',id:exam},500);
 });ok('start mirror failure rolls back whole route transaction');
 const f=await post(a,{action:'startExam',id:exam});
 await fault("ALTER TABLE farmakon.attempt_shadow ADD CONSTRAINT p06_fault CHECK(false) NOT VALID",async()=>{
  await post(a,{action:'saveExam',id:f.id,answers:{[qs[0]]:1}},500);
 });ok('save mirror failure preserves answers and both copies');
 await post(a,{action:'saveExam',id:f.id,answers:{[qs[0]]:1}});
 await fault("ALTER TABLE farmakon.event_shadow ADD CONSTRAINT p06_fault CHECK(false) NOT VALID",async()=>{
  await post(a,{action:'submitExam',id:f.id,answers:{}},500);
 });ok('submit event mirror failure rolls back attempt grade and event');
 const recovered=await post(a,{action:'submitExam',id:f.id,answers:{}});
 assert.equal(recovered.score,1);
 const frozen=(await pool.query('SELECT data FROM farmakon.records WHERE id=$1',[f.id])).rows[0].data;
 assert.deepEqual(await post(a,{action:'submitExam',id:f.id,answers:{[qs[0]]:0}}),recovered);
 assert.equal((await pool.query('SELECT data FROM farmakon.records WHERE id=$1',[f.id])).rows[0].data,frozen);
 ok('retry after rollback commits once and done result stays immutable');
 const g=await post(a,{action:'startExam',id:exam});
 await post(a,{action:'saveExam',id:g.id,answers:{[qs[1]]:2}});
 await pool.query("UPDATE farmakon.records SET data=jsonb_set(data::jsonb,'{deadline}',to_jsonb($1::bigint))::text WHERE id=$2",[Date.now()-20000,g.id]);
 const rawGet=()=>scope.run(a,()=>route.GET());
 await fault("ALTER TABLE farmakon.event_shadow ADD CONSTRAINT p06_fault CHECK(false) NOT VALID",async()=>{
  assert.equal((await rawGet()).status,503);
 });ok('GET settlement mirror failure rolls back grade and event');
 const settledGet=await get(a);
 const completed=settledGet.completedAttempts.find(x=>x.id===g.id);
 assert.ok(completed);assert.equal(completed.result.score,1);
 assert.equal(settledGet.attempts.some(x=>x.id===g.id),false);
 await get(a);await match();
 assert.equal((await pool.query("SELECT count(*)::int n FROM farmakon.activity WHERE kind='exam' AND target=$1",[g.id])).rows[0].n,1);
 ok('GET settles saved answers with one immutable result event');
 const leak=await post(a,{action:'startExam',id:exam});
 assert.ok(leak.questions.every(q=>!('correct' in q)&&!('explanation' in q)));
 const beforeDenied=await snapshot();
 await post(b,{action:'startExam',id:exam},403);
 await post(b,{action:'saveExam',id:leak.id,answers:{}},409);
 await post(b,{action:'submitExam',id:leak.id,answers:{}},404);
 assert.deepEqual(await snapshot(),beforeDenied);await match();
 ok('authorization failures do not alter source or shadow; answer key hidden');
 const duplicates=await pool.query("SELECT data::jsonb->>'userId',data::jsonb->>'examId',count(*) FROM farmakon.records WHERE kind='attempt' AND data::jsonb->>'status'='active' GROUP BY 1,2 HAVING count(*)>1");
 assert.equal(duplicates.rowCount,0);
 const duplicateEvents=await pool.query("SELECT user_id,kind,target,count(*) FROM farmakon.activity WHERE kind='exam' GROUP BY 1,2,3 HAVING count(*)>1");
 assert.equal(duplicateEvents.rowCount,0);await match();
 ok('no duplicate active attempts or result events after all handler cases');
 ev.result='PASS';ev.postgresVersion=(await pool.query('SHOW server_version')).rows[0].server_version;
}finally{
 try{await close();await pool.query('DROP ROLE p05_writer,p05_mirror,p05_owner');
 assert.equal((await pool.query("SELECT count(*)::int n FROM pg_namespace WHERE nspname='farmakon'")).rows[0].n,0);
 assert.equal((await pool.query("SELECT count(*)::int n FROM pg_roles WHERE rolname IN ('p05_writer','p05_owner','p05_mirror')")).rows[0].n,0);
 ok('cleanup schema and fixture roles');}
 catch(e){ev.result='FAIL';throw e;}
 finally{await pool.end();process.env.FARMAKON_TEST_DATABASE_URL=adminURL;delete globalThis.__p02;
 fs.mkdirSync('docs/evidence',{recursive:true});fs.writeFileSync('docs/evidence/P0.6-EXAM-MIRROR.json',JSON.stringify(ev,null,2)+'\n');console.log(JSON.stringify(ev));}
}
