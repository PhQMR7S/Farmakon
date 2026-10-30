// Test-only adapter prototype: actual route and server code, synthetic Auth.
// P03 test-only transactional dual-write, nonpartitioned. No production hooks/DDL.
// Serializes requests to each transaction client in the test adapter only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {Pool} from 'pg';
import {AsyncLocalStorage} from 'node:async_hooks';
import {testDatabase} from './helpers/postgres.mjs';
const {db:base,close}=await testDatabase(),pool=new Pool({connectionString:process.env.FARMAKON_TEST_DATABASE_URL,max:2,ssl:false}),scope=new AsyncLocalStorage();
await pool.query("CREATE TABLE farmakon.p02_attempts(id text PRIMARY KEY,kind text NOT NULL,course_id text NOT NULL,data text NOT NULL,created bigint NOT NULL,user_id text NOT NULL,status text NOT NULL)");
await pool.query('CREATE INDEX p02_owner_status ON farmakon.p02_attempts(user_id,status,created DESC,id DESC)');
const txQueue=new AsyncLocalStorage();
function serialized(f){const q=txQueue.getStore();if(!q)return f();const next=q.tail.then(f);q.tail=next.then(()=>{},()=>{});return next;}
const db={transaction:f=>base.transaction(()=>txQueue.run({tail:Promise.resolve()},f)),batch:s=>base.batch(s),prepare(sql){let args=[],statement=base.prepare(sql);return {bind(...a){args=a;statement.bind(...a);return this;},async first(){return serialized(async()=>{
 if(sql==='SELECT * FROM records WHERE id=?'){const q=await base.prepare('SELECT id,kind,course_id,data,created FROM farmakon.p02_attempts WHERE id=?').bind(args[0]).first();if(q)return q;}
 return statement.first();});},async all(){return serialized(async()=>{
 if(sql.startsWith("SELECT * FROM records WHERE kind=? AND json_extract(data,'$.userId')=?")&&args[0]==='attempt'){
  const status=sql.includes("json_extract(data,'$.status')=?"),limit=sql.includes(' LIMIT ?');let query='SELECT id,kind,course_id,data,created FROM farmakon.p02_attempts WHERE user_id=?';const values=[args[1]];if(status){query+=' AND status=?';values.push(args[2]);}query+=' ORDER BY created DESC,id DESC';if(limit){query+=' LIMIT ?';values.push(args[status?3:2]);}return base.prepare(query).bind(...values).all();
 }return statement.all();});},async run(){return serialized(async()=>{
 if(sql.startsWith('INSERT INTO records(id,kind,course_id,data,created)')&&args[1]==='attempt'){
  const d=JSON.parse(args[3]);await base.prepare('INSERT INTO farmakon.p02_attempts(id,kind,course_id,data,created,user_id,status) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,course_id=excluded.course_id,user_id=excluded.user_id,status=excluded.status').bind(...args,d.userId,d.status).run();return statement.run();
 }return statement.run();});}};}};
globalThis.__p02={db,user:()=>scope.getStore()};
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
 const starts=await Promise.all([post(a,{action:'startExam',id:exam}),post(a,{action:'startExam',id:exam})]);assert.equal(starts[0].id,starts[1].id);const id=starts[0].id;assert.equal(starts[0].questions[0].correct,undefined);
 await Promise.all([post(a,{action:'saveExam',id,answers:{[qs[0]]:1}}),post(a,{action:'saveExam',id,answers:{[qs[1]]:2}})]);
 const resumed=await post(a,{action:'startExam',id:exam});assert.deepEqual(resumed.answers,{[qs[0]]:1,[qs[1]]:2});
 await post(b,{action:'saveExam',id,answers:{}},409);await post(b,{action:'submitExam',id,answers:{}},404);
 const done=await Promise.all([post(a,{action:'submitExam',id,answers:{}}),post(a,{action:'submitExam',id,answers:{}})]);assert.equal(done[0].score,2);assert.deepEqual(done[0],done[1]);
 await post(a,{action:'saveExam',id,answers:{}},409);assert.equal((await pool.query("SELECT count(*)::int n FROM farmakon.activity WHERE kind='exam' AND target=$1",[id])).rows[0].n,1);
 const racing=await post(a,{action:'startExam',id:exam});const raced=await Promise.all([post(a,{action:'saveExam',id:racing.id,answers:{[qs[0]]:1}},null),post(a,{action:'submitExam',id:racing.id,answers:{}},null)]);assert.ok([200,409].includes(raced[0].status));assert.equal(raced[1].status,200);if(raced[0].status===200)assert.equal(raced[1].data.score,1);await post(a,{action:'saveExam',id:racing.id,answers:{}},409);
 // A legacy snapshot copied intact to the prototype keeps the existing grace policy.
 const legacyId='legacy-attempt',legacy={id:legacyId,userId:a.userId,examId:exam,courseId:course.id,status:'active',deadline:Date.now()-1000,questions:[{id:qs[0],correct:1,options:['a','b','c','d'],explanation:'fixture'}],answers:{}};
 await pool.query('INSERT INTO farmakon.p02_attempts VALUES($1,$2,$3,$4,$5,$6,$7)',[legacyId,'attempt',course.id,JSON.stringify(legacy),Date.now(),a.userId,'active']);await pool.query('INSERT INTO farmakon.records VALUES($1,$2,$3,$4,$5)',[legacyId,'attempt',course.id,JSON.stringify(legacy),Date.now()]);const legacyResult=await post(a,{action:'submitExam',id:legacyId,answers:{[qs[0]]:1}});assert.equal(legacyResult.score,1);
 const exp=await post(a,{action:'startExam',id:exam});const stored=(await pool.query('SELECT data FROM farmakon.p02_attempts WHERE id=$1',[exp.id])).rows[0];const data=JSON.parse(stored.data);data.deadline=Date.now()-1000;await pool.query('UPDATE farmakon.p02_attempts SET data=$1 WHERE id=$2',[JSON.stringify(data),exp.id]);await pool.query('UPDATE farmakon.records SET data=$1 WHERE id=$2',[JSON.stringify(data),exp.id]);await post(a,{action:'saveExam',id:exp.id,answers:{[qs[0]]:1}},409);const settled=await post(a,{action:'submitExam',id:exp.id,answers:{[qs[0]]:1}});assert.equal(settled.score,0);
 const active=await post(a,{action:'startExam',id:exam});const en=(await pool.query('SELECT id FROM farmakon.enrollments WHERE email=$1',[a.email])).rows[0];await pool.query('UPDATE farmakon.enrollments SET expires=$1 WHERE id=$2',[Date.now()-1,en.id]);await post(a,{action:'saveExam',id:active.id,answers:{}},403);await post(owner,{action:'enroll',email:a.email,courseId:course.id,days:30});await post(owner,{action:'revoke',id:en.id});assert.equal((await get(a)).attempts.length,0);await post(a,{action:'saveExam',id:active.id,answers:{}},403);await post(a,{action:'submitExam',id:active.id,answers:{}},403);
 const divergence=await pool.query("SELECT count(*)::int n FROM farmakon.records r JOIN farmakon.p02_attempts t ON t.id=r.id WHERE r.kind='attempt' AND r.data<>t.data");assert.equal(divergence.rows[0].n,0);
 console.log('PASS actual platform handlers and server exam logic with test-only serialized transactional dual-write adapter: double start, patches, resume, cross-user denial, repeated submission, saved score, deadline and revoked access. Auth/rate are fixtures; no migration or live provider.');
}finally{await pool.end();await close();delete globalThis.__p02;console.log('CLEANUP isolated schema and pools');}

