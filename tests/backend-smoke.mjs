import ts from 'typescript';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import assert from 'node:assert/strict';
let sql,db,closeDatabase=async()=>{};
if(process.env.FARMAKON_TEST_DATABASE_URL){
 const pg=await import('./helpers/postgres.mjs');({db,close:closeDatabase}=await pg.testDatabase());
}else{
sql=new DatabaseSync(':memory:');sql.exec(fs.readFileSync('drizzle/0000_woozy_ezekiel_stane.sql','utf8').replaceAll('--> statement-breakpoint',''));
db={prepare(query){let args=[];return {bind(...a){args=a;return this},async first(){return sql.prepare(query).get(...args)||null},async all(){return {results:sql.prepare(query).all(...args)}},async run(){const r=sql.prepare(query).run(...args);return {meta:{changes:Number(r.changes)}}}}},async transaction(work){if(this.inTransaction)return work();sql.exec('BEGIN');this.inTransaction=true;try{const result=await work();sql.exec('COMMIT');return result}catch(e){sql.exec('ROLLBACK');throw e}finally{this.inTransaction=false}},async batch(statements){return this.transaction(async()=>{const out=[];for(const s of statements)out.push(await s.run());return out})}};
}
try {
let user=null;const assets=new Map();globalThis.__farmTest={env:{DB:db,BUCKET:{async put(id,body){assets.set(id,new Uint8Array(await new Response(body).arrayBuffer()))},async get(id){const bytes=assets.get(id);return bytes?{body:bytes,size:bytes.length}:null}}},user:()=>user};
function compile(source){return ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText}
process.env.FARMAKON_OWNER_EMAIL='owner@example.test';
const serverSource=fs.readFileSync('app/lib/server.ts','utf8').replace(/^import .*;$/gm,'').replace('export const db=()=>database;','export const db=()=>globalThis.__farmTest.env.DB;').replace('export const bucket=()=>storage;','export const bucket=()=>globalThis.__farmTest.env.BUCKET;').replace(/export async function identity\(\)\{.*?\nexport async function owner/s,"export async function identity(){const u=globalThis.__farmTest.user();if(!u)throw new Error('AUTH');return u;}\nexport async function owner");
const serverURL='data:text/javascript;base64,'+Buffer.from(compile(serverSource)).toString('base64');
// Resolve installed zod through the project, while exercising the actual route source.
const zodURL=import.meta.resolve('zod');
const httpURL='data:text/javascript;base64,'+Buffer.from(compile(fs.readFileSync('lib/http.ts','utf8'))).toString('base64');
const databaseURL='data:text/javascript;base64,'+Buffer.from('export const database=globalThis.__farmTest.env.DB;').toString('base64');
const rateURL='data:text/javascript;base64,'+Buffer.from(compile(fs.readFileSync('lib/farmakon/rate-limit.ts','utf8').replace("'../database'",JSON.stringify(databaseURL)))).toString('base64');
const routeSource=fs.readFileSync('app/api/platform/route.ts','utf8').replace("'../../lib/server'",JSON.stringify(serverURL)).replace("'zod'",JSON.stringify(zodURL)).replace("'../../../lib/http'",JSON.stringify(httpURL)).replace("'../../../lib/farmakon/rate-limit'",JSON.stringify(rateURL));
const mod=await import('data:text/javascript;base64,'+Buffer.from(compile(routeSource)).toString('base64'));
const mediaSource=fs.readFileSync('app/api/media/route.ts','utf8').replace("'../../lib/server'",JSON.stringify(serverURL)).replace("'../../../lib/http'",JSON.stringify(httpURL)).replace("'../../../lib/farmakon/rate-limit'",JSON.stringify(rateURL));
const media=await import('data:text/javascript;base64,'+Buffer.from(compile(mediaSource)).toString('base64'));
const owner={userId:'owner',email:'owner@example.test',displayName:'Owner'};const student={userId:'student',email:'student@example.test',displayName:'Student'};
async function post(b,status=200){const r=await mod.POST(new Request('https://farm.test/api/platform',{method:'POST',headers:{origin:'https://farm.test','Content-Type':'application/json'},body:JSON.stringify(b)}));assert.equal(r.status,status,JSON.stringify(await r.clone().json()));return r.json()}
const originalError=console.error;console.error=()=>{};assert.equal((await mod.GET()).status,401);assert.equal((await media.GET(new Request('https://farm.test/api/media?id=missing'))).status,401);console.error=originalError;user=owner;await post({action:'setup'},403);user={userId:'first-get',email:'first-get@example.test',displayName:'First visit'};assert.equal((await mod.GET()).status,200);assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM members WHERE id=?').bind('first-get').first()).n,1);user=owner;
const c=await post({action:'save',kind:'course',data:{title:'Test course',description:'',stage:'3',category:'Pharmacy',price:50000,days:180,status:'published',color:'teal'}});
const upload=await media.POST(new Request('https://farm.test/api/media?courseId='+c.id+'&name=test.pdf',{method:'POST',headers:{origin:'https://farm.test','Content-Type':'application/pdf','Content-Length':'8'},body:'%PDFtest'}));assert.equal(upload.status,200);const asset=await upload.json();
const l=await post({action:'save',kind:'lesson',data:{title:'Lesson',courseId:c.id,module:'One',order:1,minutes:30,url:asset.url,assetId:asset.id,description:'',free:false,status:'published',download:true}});
const q=await post({action:'save',kind:'question',data:{title:'Test question',courseId:c.id,topic:'test',options:['one','two','three','four'],correct:1,explanation:'Explanation',source:'Test reference',status:'published',free:false}});
const ex=await post({action:'save',kind:'exam',data:{title:'Test exam',courseId:c.id,minutes:20,questionIds:[q.id],free:false,status:'published'}});
const code=await post({action:'code',courseId:c.id,days:180,confirmed:true});user=student;
await post({action:'save',kind:'course',data:{}},403);let state=await(await mod.GET()).json();assert.equal(state.lesson[0].locked,true);assert.equal(state.question.length,0);assert.equal((await media.GET(new Request('https://farm.test/api/media?id='+asset.id))).status,403);
await post({action:'redeem',code:code.code});await post({action:'redeem',code:code.code},400);state=await(await mod.GET()).json();assert.equal(state.enrollments.length,1);assert.equal(state.question[0].correct,undefined);assert.equal(state.question[0].explanation,undefined);assert.equal((await media.GET(new Request('https://farm.test/api/media?id='+asset.id))).status,200);
await post({action:'progress',id:l.id,data:{seconds:45,completed:false,note:'My note'}});state=await(await mod.GET()).json();assert.equal(state.activity[0].data.note,'My note');
const at=await post({action:'startExam',id:ex.id});assert.equal(at.questions[0].correct,undefined);await post({action:'answer',id:q.id,selected:0},409);await post({action:'saveExam',id:at.id,answers:{[q.id]:1}});const resumed=await post({action:'startExam',id:ex.id});assert.equal(resumed.id,at.id);assert.equal(resumed.answers[q.id],1);const result=await post({action:'submitExam',id:at.id,answers:{[q.id]:1}});assert.equal(result.score,1);
await post({action:'order',courseId:c.id,reference:'transfer123'});await post({action:'order',courseId:c.id,reference:'transfer123'},409);user=owner;state=await(await mod.GET()).json();const o=state.orders[0];const beforeCount=(await db.prepare('SELECT COUNT(*) AS n FROM enrollments').first()).n;const issued=await post({action:'reviewOrder',id:o.id,status:'approved'});assert.ok(issued.code.startsWith('FK-'));assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM enrollments').first()).n,beforeCount);assert.ok(await db.prepare('SELECT * FROM codes WHERE suffix=?').bind(issued.code.slice(-4)).first());await post({action:'code',courseId:c.id,days:180},400);await post({action:'reviewOrder',id:o.id,status:'approved'},409);
await post({action:'enroll',email:student.email,courseId:c.id,days:365});const before=(await db.prepare('SELECT expires FROM enrollments WHERE email=?').bind(student.email).first()).expires;await post({action:'enroll',email:student.email,courseId:c.id,days:1});assert.ok((await db.prepare('SELECT expires FROM enrollments WHERE email=?').bind(student.email).first()).expires>before);await post({action:'archive',id:c.id});user=student;assert.equal((await media.GET(new Request('https://farm.test/api/media?id='+asset.id))).status,403);
// Regression: a second student must never obtain another student's attempt or notes.
const other={userId:'other',email:'other@example.test',displayName:'Other'};
user=owner;await post({action:'save',kind:'course',id:c.id,data:{title:'Test course',description:'',stage:'3',category:'Pharmacy',price:50000,days:180,status:'published',color:'teal'}});
user=student;const revokedAttempt=await post({action:'startExam',id:ex.id});
user=other;state=await(await mod.GET()).json();assert.equal(state.attempts.length,0);assert.equal(state.activity.length,0);
await post({action:'saveExam',id:revokedAttempt.id,answers:{}},409);await post({action:'submitExam',id:revokedAttempt.id,answers:{}},404);
user=owner;const enrollment=await db.prepare('SELECT id FROM enrollments WHERE email=?').bind(student.email).first();await post({action:'revoke',id:enrollment.id});
user=student;state=await(await mod.GET()).json();assert.equal(state.attempts.length,0,'revoked enrollment must hide active attempt snapshots');
await post({action:'saveExam',id:revokedAttempt.id,answers:{}},403);await post({action:'submitExam',id:revokedAttempt.id,answers:{}},403);await post({action:'submitExam',id:at.id,answers:{}},403);
user=owner;await post({action:'enroll',email:student.email,courseId:c.id,days:1});await post({action:'archive',id:c.id});
user=student;state=await(await mod.GET()).json();assert.equal(state.attempts.length,0,'unpublished course must hide active attempts');await post({action:'submitExam',id:revokedAttempt.id,answers:{}},403);
if(process.env.FARMAKON_TEST_DATABASE_URL){
 // Real PostgreSQL only: SQLite's single connection is not a concurrency proof.
 user=owner;await post({action:'save',kind:'course',id:c.id,data:{title:'Test course',description:'',stage:'3',category:'Pharmacy',price:50000,days:180,status:'published',color:'teal'}});
 user=student;await post({action:'submitExam',id:revokedAttempt.id,answers:{[q.id]:1}});
 const starts=await Promise.all(Array.from({length:4},()=>post({action:'startExam',id:ex.id})));
 assert.equal(new Set(starts.map(a=>a.id)).size,1,'concurrent starts must resume one attempt');
 const attemptId=starts[0].id;
 const submitted=await Promise.all(Array.from({length:4},()=>post({action:'submitExam',id:attemptId,answers:{[q.id]:1}})));
 for(const result of submitted)assert.deepEqual(result,submitted[0]);
 assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM activity WHERE target=? AND kind=?').bind(attemptId,'exam').first()).n,1);
 const saveAfter=await post({action:'saveExam',id:attemptId,answers:{}},409);assert.ok(saveAfter.error);
 user=owner;const concurrentCode=await post({action:'code',courseId:c.id,days:1,confirmed:true});user=student;
 const replies=await Promise.all(Array.from({length:4},async()=>{
  const r=await mod.POST(new Request('https://farm.test/api/platform',{method:'POST',headers:{origin:'https://farm.test','Content-Type':'application/json'},body:JSON.stringify({action:'redeem',code:concurrentCode.code})}));return r.status;
 }));assert.equal(replies.filter(s=>s===200).length,1);assert.ok(replies.every(s=>[200,400,409].includes(s)));
 // A save and submit racing cannot resurrect a finalized attempt or duplicate its result.
 const raceAttempt=await post({action:'startExam',id:ex.id});
 const race=await Promise.all([{action:'saveExam',id:raceAttempt.id,answers:{}},{action:'submitExam',id:raceAttempt.id,answers:{[q.id]:1}}].map(async body=>{
  const r=await mod.POST(new Request('https://farm.test/api/platform',{method:'POST',headers:{origin:'https://farm.test','Content-Type':'application/json'},body:JSON.stringify(body)}));return r.status;
 }));assert.ok(race.every(s=>[200,409].includes(s)));
 const stored=await db.prepare('SELECT data FROM records WHERE id=?').bind(raceAttempt.id).first();assert.equal(JSON.parse(stored.data).status,'done');
 process.env.FARMAKON_RATE_LIMIT_SECRET='fixture-only-test-secret-at-least-32-characters';
 const {consumeLimit}=await import(rateURL);
 const quota=await Promise.all(Array.from({length:8},()=>consumeLimit('test','synthetic-identity',4,1000,10000)));
 assert.equal(quota.filter(r=>r.allowed).length,4);
 assert.equal((await consumeLimit('test','another-identity',4,1000,10000)).allowed,true);
 assert.equal((await consumeLimit('test','synthetic-identity',4,1000,11000)).allowed,true);
 const keys=await db.prepare('SELECT key FROM farmakon.rate_limits').all();assert.ok(keys.results.every(r=>/^[a-f0-9]{64}$/.test(r.key)));
 console.log('PASS: concurrent distributed quota, boundary reset, independent identities and hashed keys.');
 console.log('PASS: PostgreSQL concurrent start, submit, save/submit and single-use redemption; one result event, stable responses.');
}
console.log('PASS: two-user notes/attempt isolation and revocation/unpublication on attempt read/save/submit.');
user=owner;
const overflow=await mod.POST(new Request('https://farm.test/api/platform',{method:'POST',headers:{origin:'https://farm.test','content-length':'1'},body:JSON.stringify({action:'ticket',description:'x'.repeat(250001)})}));assert.equal(overflow.status,413);
const malformed=await mod.POST(new Request('https://farm.test/api/platform',{method:'POST',headers:{origin:'https://farm.test'},body:'not json'}));assert.equal(malformed.status,400);
const badUpload=await media.POST(new Request('https://farm.test/api/media?courseId='+c.id,{method:'POST',headers:{origin:'https://farm.test','content-type':'application/pdf','content-length':'1'},body:'%PDFtest'}));assert.equal(badUpload.status,400);
console.log('PASS: API rejects chunked/underdeclared overflow, malformed JSON and mismatched upload length.');
const csrf=await mod.POST(new Request('https://farm.test/api/platform',{method:'POST',headers:{origin:'https://evil.test'},body:'{}'}));assert.equal(csrf.status,403);
console.log('PASS: auth, owner setup, CRUD, upload/read, course gating, answer secrecy, one-time codes, persistent progress, exam resume/grading, payment review, course unpublish, CSRF. Isolated fixture database; no production data.');

const driveSource=compile(fs.readFileSync('app/lib/drive.ts','utf8'));const {drivePreview}=await import('data:text/javascript;base64,'+Buffer.from(driveSource).toString('base64'));assert.equal(drivePreview('https://drive.google.com/file/d/abc_123/view?resourcekey=key'),'https://drive.google.com/file/d/abc_123/preview?resourcekey=key');assert.equal(drivePreview('https://drive.google.com.evil.test/file/d/abc/view'),null);assert.equal(drivePreview('javascript:alert(1)'),null);console.log('PASS: Drive URL allowlist and payment approval issues a code without enrollment.');

} finally { await closeDatabase(); }
