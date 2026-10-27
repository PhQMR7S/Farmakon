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
const helpers=await import(serverURL);
assert.equal(helpers.examDue({deadline:100,timingVersion:2},100),true);
assert.equal(helpers.examDue({deadline:100},15100),false);
assert.equal(helpers.examDue({deadline:100},15101),true);
assert.deepEqual(helpers.examAnswers({questions:[{id:'q'}],answers:{q:1}},{}),{q:1});
assert.throws(()=>helpers.examAnswers({questions:[],answers:{}},{unknown:1}),/EXAM_ANSWERS/);
console.log('PASS F00.6 unit: exact new/legacy timing boundaries and answer-patch membership.');
const mod=await import('data:text/javascript;base64,'+Buffer.from(compile(routeSource)).toString('base64'));
const mediaSource=fs.readFileSync('app/api/media/route.ts','utf8').replace("'../../lib/server'",JSON.stringify(serverURL)).replace("'../../../lib/http'",JSON.stringify(httpURL)).replace("'../../../lib/farmakon/rate-limit'",JSON.stringify(rateURL));
const media=await import('data:text/javascript;base64,'+Buffer.from(compile(mediaSource)).toString('base64'));
const exportSource=fs.readFileSync('app/api/account/export/route.ts','utf8').replace("'../../../lib/server'",JSON.stringify(serverURL)).replace("'../../../../lib/http'",JSON.stringify(httpURL)).replace("'../../../../lib/farmakon/rate-limit'",JSON.stringify(rateURL));
const studyExport=await import('data:text/javascript;base64,'+Buffer.from(compile(exportSource)).toString('base64'));
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

// Personal study export must not become an alternative course-content or admin API.
const exportRequest=(body='{}',origin='https://farm.test')=>studyExport.POST(new Request('https://farm.test/api/account/export',{method:'POST',headers:{origin,'content-type':'application/json'},body}));
user=null;assert.equal((await exportRequest()).status,401);user=student;
assert.equal((await exportRequest('{}','https://evil.test')).status,403);
assert.equal((await exportRequest(JSON.stringify({userId:other.userId}))).status,400);
assert.equal((await exportRequest('x'.repeat(1025))).status,413);
await db.prepare('INSERT INTO records(id,kind,course_id,data,created) VALUES(?,?,?,?,?)').bind('export-attempt','attempt',c.id,JSON.stringify({userId:student.userId,examId:ex.id,courseId:c.id,status:'done',answers:{valid:2,invalid:'PROTECTED_ANSWER',outOfRange:55},questions:[{correct:1,title:'PROTECTED_QUESTION'}],result:{score:1,total:1,late:false,questions:[{explanation:'PROTECTED_EXPLANATION'}]},internal:'PRIVATE_ADMIN'}),1).run();
await db.prepare('INSERT INTO records(id,kind,course_id,data,created) VALUES(?,?,?,?,?)').bind('export-other','ticket','',JSON.stringify({userId:other.userId,title:'OTHER_STUDENT_PRIVATE',description:'OTHER_STUDENT_PRIVATE'}),1).run();
await db.prepare('INSERT INTO records(id,kind,course_id,data,created) VALUES(?,?,?,?,?)').bind('export-ticket','ticket','',JSON.stringify({userId:student.userId,title:'My ticket',description:'My description',reply:'Reply for me',status:'closed',reviewedBy:'PRIVATE_ADMIN',internal:'PRIVATE_ADMIN'}),1).run();
const exported=await exportRequest();assert.equal(exported.status,200);assert.equal(exported.headers.get('cache-control'),'private, no-store');assert.equal(exported.headers.get('content-disposition'),'attachment; filename="farmakon-study-data.json"');
const exportText=await exported.text(),myData=JSON.parse(exportText);assert.equal(myData.profile.email,student.email);
assert.ok(myData.activity.some(a=>a.data.note==='My note'));assert.ok(myData.tickets.some(t=>t.title==='My ticket'&&t.reply==='Reply for me'));
assert.deepEqual(myData.attempts.find(a=>a.id==='export-attempt').answers,{valid:2});
for(const forbidden of ['OTHER_STUDENT_PRIVATE','PROTECTED_QUESTION','PROTECTED_ANSWER','PROTECTED_EXPLANATION','PRIVATE_ADMIN','"correct"','"questions"','"codes"','"audit"'])assert.ok(!exportText.includes(forbidden),forbidden);
user=other;const otherData=await(await exportRequest()).json();assert.equal(otherData.activity.length,0);assert.equal(otherData.attempts.length,0);assert.equal(otherData.tickets[0].title,'OTHER_STUDENT_PRIVATE');assert.ok(!JSON.stringify(otherData).includes('My note'));
user=student;
if(process.env.FARMAKON_TEST_DATABASE_URL){
 process.env.FARMAKON_RATE_LIMIT_ENABLED='true';
 for(let i=0;i<5;i++)assert.equal((await exportRequest()).status,200);
 const throttled=await exportRequest();assert.equal(throttled.status,429);assert.ok(Number(throttled.headers.get('retry-after'))>0);
 delete process.env.FARMAKON_RATE_LIMIT_ENABLED;
}
await db.prepare('INSERT INTO activity(id,user_id,kind,target,data,updated) VALUES(?,?,?,?,?,?)').bind('export-too-large',student.userId,'progress','large-fixture',JSON.stringify({note:'x'.repeat(1400000)}),0).run();
const tooLarge=await exportRequest();assert.equal(tooLarge.status,413);assert.equal((await tooLarge.json()).profile,undefined,'Never silently export a partial dataset');
console.log('PASS: scoped study export, cross-user/admin/content secrecy, bounded output, CSRF/auth, attachment headers and PostgreSQL quota.');

const driveSource=compile(fs.readFileSync('app/lib/drive.ts','utf8'));const {drivePreview}=await import('data:text/javascript;base64,'+Buffer.from(driveSource).toString('base64'));assert.equal(drivePreview('https://drive.google.com/file/d/abc_123/view?resourcekey=key'),'https://drive.google.com/file/d/abc_123/preview?resourcekey=key');assert.equal(drivePreview('https://drive.google.com.evil.test/file/d/abc/view'),null);assert.equal(drivePreview('javascript:alert(1)'),null);console.log('PASS: Drive URL allowlist and payment approval issues a code without enrollment.');

// F00.6: controllable server clock exists only inside this test process.
const realNow=Date.now;let clock=realNow();Date.now=()=>clock;
try{
 user=owner;await post({action:'save',kind:'course',id:c.id,data:{title:'Test course',description:'',stage:'3',category:'Pharmacy',price:50000,days:180,status:'published',color:'teal'}});await post({action:'enroll',email:student.email,courseId:c.id,days:1});
 const q2=await post({action:'save',kind:'question',data:{title:'Second snapshot question',courseId:c.id,topic:'test',options:['one','two','three','four'],correct:2,explanation:'Original key explanation',source:'Fixture',status:'published',free:false}});
 const timed=await post({action:'save',kind:'exam',data:{title:'Clock fixture',courseId:c.id,minutes:1,questionIds:[q.id,q2.id],free:false,status:'published'}});
 user=student;const first=await post({action:'startExam',id:timed.id});assert.equal(first.startedAt,clock);assert.equal(first.deadline,clock+60000);assert.equal(first.serverNow,clock);assert.equal(first.timingVersion,2);assert.ok(!JSON.stringify(first).includes('"correct"'));
 clock+=10000;assert.equal((await post({action:'startExam',id:timed.id})).deadline,first.deadline);
 await post({action:'saveExam',id:first.id,answers:{[q.id]:1}});await post({action:'saveExam',id:first.id,answers:{notInSnapshot:0}},400);
 // Administration edits must not change the held snapshot or scoring key.
 user=owner;await post({action:'save',kind:'question',id:q2.id,data:{title:'Edited after start',courseId:c.id,topic:'test',options:['new one','new two','new three','new four'],correct:0,explanation:'Changed',source:'Fixture',status:'draft',free:false}});
 user=student;clock=first.deadline-1;await post({action:'saveExam',id:first.id,answers:{[q2.id]:2}});
 clock=first.deadline;await post({action:'saveExam',id:first.id,answers:{[q.id]:0}},409);
 // A request processed at deadline cannot inject new answers through submit's grace.
 const expired=await post({action:'submitExam',id:first.id,answers:{[q.id]:0,[q2.id]:0}});assert.equal(expired.score,2);assert.equal(expired.expired,true);assert.equal(expired.late,false);assert.equal(expired.questions[1].title,'Second snapshot question');
 assert.deepEqual(await post({action:'submitExam',id:first.id,answers:{}}),expired);
 assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM activity WHERE target=? AND kind=?').bind(first.id,'exam').first()).n,1);
 // Direct submit while still active in the 15s transport grace cannot inject.
 const direct=await post({action:'startExam',id:ex.id});await post({action:'saveExam',id:direct.id,answers:{[q.id]:1}});clock=direct.deadline+5000;
 const graceResult=await post({action:'submitExam',id:direct.id,answers:{[q.id]:0}});assert.equal(graceResult.score,1);assert.equal(graceResult.expired,true);assert.equal(graceResult.late,false);
 // Close all pages: no client event, then lazy settlement on actual GET.
 const absent=await post({action:'startExam',id:ex.id});await post({action:'saveExam',id:absent.id,answers:{[q.id]:1}});clock=absent.deadline+20000;
 state=await(await mod.GET()).json();assert.ok(state.completedAttempts.some(a=>a.id===absent.id&&a.result.score===1&&a.result.late));assert.ok(!state.attempts.some(a=>a.id===absent.id));
 await mod.GET();assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM activity WHERE target=? AND kind=?').bind(absent.id,'exam').first()).n,1);
 // Old active rows retain the historical grace; awarded old rows never regrade.
 const legacy={userId:student.userId,examId:ex.id,courseId:c.id,questions:[{id:q.id,options:['a','b','c','d'],correct:1}],answers:{},deadline:clock-10000,status:'active'};
 await db.prepare('INSERT INTO records(id,kind,course_id,data,created) VALUES(?,?,?,?,?)').bind('legacy-grace','attempt',c.id,JSON.stringify(legacy),clock).run();
 state=await(await mod.GET()).json();assert.ok(state.attempts.some(a=>a.id==='legacy-grace'));
 assert.equal((await post({action:'submitExam',id:'legacy-grace',answers:{[q.id]:1}})).score,1);
 await db.prepare('INSERT INTO records(id,kind,course_id,data,created) VALUES(?,?,?,?,?)').bind('legacy-late','attempt',c.id,JSON.stringify({...legacy,deadline:clock-15001,answers:{[q.id]:1}}),clock).run();
 assert.equal((await post({action:'submitExam',id:'legacy-late',answers:{[q.id]:0}})).score,1);
 if(process.env.FARMAKON_TEST_DATABASE_URL){
  const pair=await Promise.all([post({action:'startExam',id:ex.id}),post({action:'startExam',id:ex.id})]);assert.equal(pair[0].id,pair[1].id);
  const cid=pair[0].id;
  // Two patches of different snapshot questions merge without clearing saved keys.
  user=owner;await post({action:'save',kind:'question',id:q2.id,data:{title:'Second question',courseId:c.id,topic:'test',options:['one','two','three','four'],correct:2,explanation:'Explanation',source:'Fixture',status:'published',free:false}});
  user=student;const multi=await post({action:'startExam',id:timed.id});
  await Promise.all([post({action:'saveExam',id:multi.id,answers:{[q.id]:1}}),post({action:'saveExam',id:multi.id,answers:{[q2.id]:2}})]);
  const persisted=JSON.parse((await db.prepare('SELECT data FROM records WHERE id=?').bind(multi.id).first()).data);assert.deepEqual(persisted.answers,{[q.id]:1,[q2.id]:2});
  await Promise.all([post({action:'saveExam',id:multi.id,answers:{[q.id]:0}}),post({action:'saveExam',id:multi.id,answers:{[q.id]:1}})]);
  const sameKey=JSON.parse((await db.prepare('SELECT data FROM records WHERE id=?').bind(multi.id).first()).data);assert.ok([0,1].includes(sameKey.answers[q.id]));assert.equal(sameKey.answers[q2.id],2);
  clock=pair[0].deadline+20000;await Promise.all([mod.GET(),mod.GET(),post({action:'submitExam',id:cid,answers:{[q.id]:1}})]);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM activity WHERE target=? AND kind=?').bind(cid,'exam').first()).n,1);
  const settledMulti=JSON.parse((await db.prepare('SELECT data FROM records WHERE id=?').bind(multi.id).first()).data);assert.equal(settledMulti.result.score,(sameKey.answers[q.id]===1?1:0)+1);
  console.log('PASS: PostgreSQL concurrent patch merge, two-device starts and GET/submit expiry settlement exactly once.');
 }
 const withdrawn=await post({action:'startExam',id:ex.id});
 user=owner;await post({action:'archive',id:ex.id});user=student;
 await post({action:'startExam',id:ex.id},403);await post({action:'saveExam',id:withdrawn.id,answers:{}},403);await post({action:'submitExam',id:withdrawn.id,answers:{}},403);
 state=await(await mod.GET()).json();assert.ok(!state.attempts.some(a=>a.id===withdrawn.id));
 user=owner;await post({action:'save',kind:'question',id:q2.id,data:{...await helpers.record(q2.id),status:'published'}});await post({action:'save',kind:'exam',id:ex.id,data:{title:'Edited exam definition',courseId:c.id,minutes:1,questionIds:[q2.id],free:false,status:'published'}});user=student;
 const unchanged=await post({action:'startExam',id:ex.id});assert.equal(unchanged.id,withdrawn.id);assert.equal(unchanged.deadline,withdrawn.deadline);assert.equal(unchanged.questions[0].id,q.id);
 await db.prepare('UPDATE enrollments SET expires=? WHERE email=? AND course_id=?').bind(clock+500,student.email,c.id).run();clock+=501;
 await post({action:'saveExam',id:withdrawn.id,answers:{}},403);await post({action:'submitExam',id:withdrawn.id,answers:{}},403);
 console.log('PASS F00.6: exam unpublish/republish, changed definition keeps held snapshot/deadline, subscription time expiry denies writes.');
 console.log('PASS F00.6: fixed server deadline, exact boundary, grace injection denied for v2, immutable keys, preserved acknowledged answers, lazy settlement, legacy grace and stable results.');
}finally{Date.now=realNow;}

} finally { await closeDatabase(); }
