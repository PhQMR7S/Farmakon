import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {Pool} from 'pg';
import {AsyncLocalStorage} from 'node:async_hooks';
import {testDatabase} from './helpers/postgres.mjs';
const scope=new AsyncLocalStorage(),checks=[],ev={scope:'P0.8 specialized runtime safety gates',checks,result:'FAIL',load:'NOT RUN: safety first',ssiGate:'OPEN'};
const {db,close}=await testDatabase();const pool=new Pool({connectionString:process.env.FARMAKON_TEST_DATABASE_URL,ssl:false,max:2});
await pool.query('CREATE TABLE farmakon.deletion_jobs(user_id text PRIMARY KEY,email text)');
await pool.query(fs.readFileSync('tests/fixtures/exam-store-p08.sql','utf8'));
globalThis.__p02={db,user:()=>scope.getStore()};
const ok=name=>checks.push({name,status:'PASS'});
process.env.FARMAKON_OWNER_EMAIL='owner@example.test';
const compile=s=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText).toString('base64');
const server=compile(fs.readFileSync('app/lib/server.ts','utf8').replace(/^import .*;$/gm,'').replace('export const db=()=>database;','export const db=()=>globalThis.__p02.db;').replace('export const bucket=()=>storage;','export const bucket=()=>({});').replace(/export async function identity\(\)\{.*?\nexport async function owner/s,'export async function identity(){return globalThis.__p02.user();}\nexport async function owner'));
const route=await import(compile(fs.readFileSync('app/api/platform/route.ts','utf8').replace("'../../lib/server'",JSON.stringify(server)).replace("'../../../lib/http'",JSON.stringify(compile(fs.readFileSync('lib/http.ts','utf8')))).replace("'../../../lib/farmakon/rate-limit'",JSON.stringify(compile('export async function limitRequest(){return null;}'))).replace("'zod'",JSON.stringify(import.meta.resolve('zod')))));
const owner={userId:'p02-owner',email:'owner@example.test',displayName:'Owner'},a={userId:'p02-a',email:'a@example.test',displayName:'A'},b={userId:'p02-b',email:'b@example.test',displayName:'B'};
async function post(u,body,status=200){return scope.run(u,async()=>{const r=await route.POST(new Request('https://synthetic.test/api/platform',{method:'POST',headers:{origin:'https://synthetic.test','content-type':'application/json'},body:JSON.stringify(body)}));const d=await r.json();if(status!==null)assert.equal(r.status,status,JSON.stringify({action:body.action,status:r.status}));return status===null?{status:r.status,data:d}:d;});}
async function get(u){return scope.run(u,async()=>{const r=await route.GET();assert.equal(r.status,200);return r.json();});}
try{
 const course=await post(owner,{action:'save',kind:'course',data:{title:'Synthetic',description:'',stage:'3',category:'Pharmacy',price:1,days:30,status:'published',color:'teal'}});
 await post(owner,{action:'enroll',email:a.email,courseId:course.id,days:30});
 const qs=[];for(let i=0;i<2;i++)qs.push((await post(owner,{action:'save',kind:'question',data:{title:'Question '+i,courseId:course.id,topic:'',options:['a','b','c','d'],correct:i+1,explanation:'explanation',source:'source',status:'published',free:false}})).id);
 const exam=(await post(owner,{action:'save',kind:'exam',data:{title:'Exam',courseId:course.id,minutes:20,questionIds:qs,status:'published',free:false}})).id;
 const starts=await Promise.all([post(a,{action:'startExam',id:exam}),post(a,{action:'startExam',id:exam})]);assert.equal(starts[0].id,starts[1].id);const id=starts[0].id;ok('concurrent original startExam creates one attempt');assert.equal(starts[0].questions[0].correct,undefined);
 await Promise.all([post(a,{action:'saveExam',id,answers:{[qs[0]]:1}}),post(a,{action:'saveExam',id,answers:{[qs[1]]:2}})]);
 const resumed=await post(a,{action:'startExam',id:exam});assert.deepEqual(resumed.answers,{[qs[0]]:1,[qs[1]]:2});ok('concurrent save patches survive and resume unchanged');
 await post(b,{action:'saveExam',id,answers:{}},409);await post(b,{action:'submitExam',id,answers:{}},404);
 ok('cross-user save and submit denied');const done=await Promise.all([post(a,{action:'submitExam',id,answers:{}}),post(a,{action:'submitExam',id,answers:{}})]);assert.equal(done[0].score,2);assert.deepEqual(done[0],done[1]);ok('concurrent submit returns identical grade');
 await post(a,{action:'saveExam',id,answers:{}},409);assert.equal((await pool.query("SELECT count(*)::int n FROM farmakon.activity WHERE kind='exam' AND target=$1",[id])).rows[0].n,1);
 ok('done rejects save and has one result event');const racing=await post(a,{action:'startExam',id:exam});const raced=await Promise.all([post(a,{action:'saveExam',id:racing.id,answers:{[qs[0]]:1}},null),post(a,{action:'submitExam',id:racing.id,answers:{}},null)]);assert.ok([200,409].includes(raced[0].status));assert.equal(raced[1].status,200);if(raced[0].status===200)assert.equal(raced[1].data.score,1);await post(a,{action:'saveExam',id:racing.id,answers:{}},409);
 ok('save versus submit preserves accepted answers and final state');

 // Flag disabled by default: legacy handlers still own existing data.
 const legacySnapshot=(await pool.query("SELECT id,data,created FROM farmakon.records WHERE kind='attempt' ORDER BY id")).rows;
 assert.ok(legacySnapshot.length>0);
 // Fixture-only activation under exclusive locks; never executed against a service.
 await pool.query('BEGIN; LOCK TABLE farmakon.records,farmakon.activity,farmakon.exam_attempts,farmakon.exam_results IN ACCESS EXCLUSIVE MODE');
 await pool.query("INSERT INTO farmakon.exam_attempts SELECT data::jsonb->>'userId',id,kind,course_id,data,created FROM farmakon.records WHERE kind='attempt'");
 await pool.query("INSERT INTO farmakon.exam_results SELECT * FROM farmakon.activity WHERE kind='exam'");
 await pool.query("DELETE FROM farmakon.records WHERE kind='attempt'; DELETE FROM farmakon.activity WHERE kind='exam'; UPDATE farmakon.exam_store_control SET ready=true; COMMIT");
 process.env.FARMAKON_EXAM_STORE_ENABLED='true';
 assert.deepEqual((await pool.query('SELECT id,data,created FROM farmakon.exam_attempts ORDER BY id')).rows,legacySnapshot);
 ok('fixture activation preserves legacy JSON, IDs, dates and grades');
 const modern=await post(a,{action:'startExam',id:exam});
 await post(a,{action:'saveExam',id:modern.id,answers:{[qs[0]]:1}});
 const grade=await post(a,{action:'submitExam',id:modern.id,answers:{}});
 assert.equal(grade.score,1);assert.deepEqual(await post(a,{action:'submitExam',id:modern.id,answers:{[qs[0]]:0}}),grade);
 assert.equal((await pool.query("SELECT count(*)::int n FROM farmakon.records WHERE kind='attempt'")).rows[0].n,0);
 ok('specialized runtime writes attempts and results outside generic tables');
 const twins=await Promise.all([post(a,{action:'startExam',id:exam}),post(a,{action:'startExam',id:exam})]);assert.equal(twins[0].id,twins[1].id);
 await Promise.all([post(a,{action:'saveExam',id:twins[0].id,answers:{[qs[0]]:1}}),post(a,{action:'saveExam',id:twins[0].id,answers:{[qs[1]]:2}})]);
 const resume=await post(a,{action:'startExam',id:exam});assert.deepEqual(resume.answers,{[qs[0]]:1,[qs[1]]:2});
 await post(b,{action:'submitExam',id:resume.id,answers:{}},404);
 ok('specialized concurrent start/save/resume and ownership');
 await pool.query("UPDATE farmakon.exam_attempts SET data=jsonb_set(data::jsonb,'{deadline}',to_jsonb($1::bigint))::text WHERE user_id=$2 AND id=$3",[Date.now()-20000,a.userId,resume.id]);
 const dash=await get(a);assert.equal(dash.completedAttempts.find(t=>t.id===resume.id).result.score,2);
 ok('GET settlement retains saved answers and original timing policy');
 const exporter=await import(compile(fs.readFileSync('app/api/account/export/route.ts','utf8').replace("'../../../lib/server'",JSON.stringify(server)).replace("'../../../../lib/http'",JSON.stringify(compile(fs.readFileSync('lib/http.ts','utf8')))).replace("'../../../../lib/farmakon/rate-limit'",JSON.stringify(compile('export async function limitRequest(){return null;}')))));
 const exportResponse=await scope.run(a,()=>exporter.POST(new Request('https://synthetic.test/api/account/export',{method:'POST',headers:{origin:'https://synthetic.test','content-type':'application/json'},body:'{}'})));
 assert.equal(exportResponse.status,200);
 const exported=await exportResponse.json();assert.ok(exported.attempts.some(t=>t.id===modern.id&&t.result.score===1));assert.ok(exported.attempts.some(t=>t.id===legacySnapshot[0].id));
 assert.ok(!JSON.stringify(exported).includes('"correct"'));
 ok('actual export includes legacy and specialized results without answer keys');
 // Switching the flag alone must fail closed, not silently hide modern data.
 process.env.FARMAKON_EXAM_STORE_ENABLED='false';
 await assert.rejects(()=>db.transaction(()=>db.prepare('SELECT 1').first()),/EXAM_STORE_MODE_MISMATCH/);
 process.env.FARMAKON_EXAM_STORE_ENABLED='true';
 ok('flag-only rollback is rejected before legacy reads');
 // Actual purge implementation, with only the database import bound to test DB.
 const purgeModule=await import(compile(fs.readFileSync('lib/farmakon/privacy/store.ts','utf8').replace("import {database} from '../../database';",'const database=globalThis.__p02.db;').replace(/^import type .*;$/gm,'')));
 const retained=await post(owner,{action:'startExam',id:exam});
 await post(owner,{action:'saveExam',id:retained.id,answers:{[qs[0]]:1}});
 await post(owner,{action:'submitExam',id:retained.id,answers:{}});
 const retainedJSON=(await pool.query('SELECT data FROM farmakon.exam_attempts WHERE user_id=$1 AND id=$2',[owner.userId,retained.id])).rows[0].data;
 await db.transaction(()=>db.prepare('INSERT INTO farmakon.deletion_jobs(user_id,email) VALUES(?,?)').bind(a.userId,a.email).run());
 const beforeDelete=(await pool.query('SELECT count(*)::int n FROM farmakon.exam_attempts WHERE user_id=$1',[a.userId])).rows[0].n;assert.ok(beforeDelete>0);
 await purgeModule.deletionStore(db).purge(a.userId,a.email);
 assert.equal((await pool.query('SELECT count(*)::int n FROM farmakon.exam_attempts WHERE user_id=$1',[a.userId])).rows[0].n,0);
 assert.equal((await pool.query('SELECT count(*)::int n FROM farmakon.exam_results WHERE user_id=$1',[a.userId])).rows[0].n,0);
 ok('actual purge removes specialized attempts and results atomically');
 await post(a,{action:'startExam',id:exam},500);
 assert.equal((await pool.query('SELECT count(*)::int n FROM farmakon.exam_attempts WHERE user_id=$1',[a.userId])).rows[0].n,0);
 ok('accepted deletion blocks stale authenticated writer from recreating attempts');
 // Rollback procedure exercised only on synthetic rows still in specialized storage.
 await pool.query('BEGIN; LOCK TABLE farmakon.records,farmakon.activity,farmakon.exam_attempts,farmakon.exam_results IN ACCESS EXCLUSIVE MODE');
 await pool.query("UPDATE farmakon.exam_store_control SET ready=false");
 await pool.query("INSERT INTO farmakon.records SELECT id,kind,course_id,data,created FROM farmakon.exam_attempts");
 await pool.query("INSERT INTO farmakon.activity SELECT * FROM farmakon.exam_results");
 await pool.query('DELETE FROM farmakon.exam_attempts; DELETE FROM farmakon.exam_results; COMMIT');
 process.env.FARMAKON_EXAM_STORE_ENABLED='false';
 await db.transaction(()=>db.prepare('SELECT 1').first());assert.equal((await pool.query('SELECT data FROM farmakon.records WHERE id=$1',[retained.id])).rows[0].data,retainedJSON);ok('prepared fixture rollback restores legacy JSON and mode');
 ev.result='PASS';ev.postgresVersion=(await pool.query('SHOW server_version')).rows[0].server_version;

}finally{try{await close();ok('cleanup isolated schema');}catch(e){ev.result='FAIL';throw e;}finally{await pool.end();delete globalThis.__p02;delete process.env.FARMAKON_EXAM_STORE_ENABLED;fs.mkdirSync('docs/evidence',{recursive:true});fs.writeFileSync('docs/evidence/P0.8-EXAM-STORE.json',JSON.stringify(ev,null,2)+'\n');console.log(JSON.stringify(ev));}}
