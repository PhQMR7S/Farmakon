// Actual route/services on isolated SQLite or real loopback PostgreSQL.
// Auth/rate-limit transport is a fixture; never connects to Supabase.
import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
import {AsyncLocalStorage} from 'node:async_hooks';
import {DatabaseSync} from 'node:sqlite';
const scope=new AsyncLocalStorage();let base,close=async()=>{};
const postgres=!!process.env.FARMAKON_TEST_DATABASE_URL;
if(postgres){({db:base,close}=await (await import('./helpers/postgres.mjs')).testDatabase());}
else{
 const sql=new DatabaseSync(':memory:');sql.exec(fs.readFileSync('drizzle/0000_woozy_ezekiel_stane.sql','utf8').replaceAll('--> statement-breakpoint',''));
 let active=false;
 base={prepare(query){let args=[];return {bind(...a){args=a;return this;},async first(){return sql.prepare(query).get(...args)||null;},async all(){return {results:sql.prepare(query).all(...args)};},async run(){return {meta:{changes:Number(sql.prepare(query).run(...args).changes)}};}};},async transaction(fn){if(active)return fn();active=true;sql.exec('BEGIN');try{const r=await fn();sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}finally{active=false;}},async batch(statements){return this.transaction(()=>Promise.all(statements.map(s=>s.run())));}};
 close=async()=>sql.close();
}
const db={transaction:fn=>base.transaction(fn),batch:s=>base.batch(s),prepare(query){const s=base.prepare(query);let args=[];const out={bind(...a){args=a;s.bind(...a);return out;}};for(const method of ['first','all','run'])out[method]=async()=>{const r=await s[method]();await scope.getStore()?.hook?.({query,args,method,result:r});return r;};return out;}};
const compile=s=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText).toString('base64');
globalThis.__subscriptions={db,user:()=>scope.getStore()?.user};
process.env.FARMAKON_OWNER_EMAIL='owner@example.test';
const server=compile(fs.readFileSync('app/lib/server.ts','utf8').replace(/^import .*;$/gm,'').replace('export const db=()=>database;','export const db=()=>globalThis.__subscriptions.db;').replace('export const bucket=()=>storage;','export const bucket=()=>({});').replace(/export async function identity\(\)\{.*?\nexport async function owner/s,'export async function identity(){const u=globalThis.__subscriptions.user();if(!u)throw Error("AUTH");return u;}\nexport async function owner'));
const route=await import(compile(fs.readFileSync('app/api/platform/route.ts','utf8').replace("'../../lib/server'",JSON.stringify(server)).replace("'../../../lib/http'",JSON.stringify(compile(fs.readFileSync('lib/http.ts','utf8')))).replace("'../../../lib/farmakon/rate-limit'",JSON.stringify(compile('export async function limitRequest(){return null;}'))).replace("'zod'",JSON.stringify(import.meta.resolve('zod')))));
const owner={userId:'subscription-owner',email:'owner@example.test',displayName:'Synthetic owner'};
const a={userId:'subscription-a',email:'subscription-a@example.test',displayName:'Synthetic A'};
const b={userId:'subscription-b',email:'subscription-b@example.test',displayName:'Synthetic B'};
const day=86400000;
async function call(user,body,expected=200,hook){return scope.run({user,hook},async()=>{const r=await route.POST(new Request('https://synthetic.test/api/platform',{method:'POST',headers:{origin:'https://synthetic.test','content-type':'application/json'},body:JSON.stringify(body)}));const data=await r.json();if(expected!==null)assert.equal(r.status,expected,JSON.stringify({action:body.action,status:r.status,data}));return {status:r.status,data};});}
const row=(u,c)=>base.prepare('SELECT * FROM enrollments WHERE email=? AND course_id=?').bind(u.email,c).first();
const code=async(course,days=30)=>(await call(owner,{action:'code',courseId:course,days,confirmed:true})).data.code;
const enroll=(u,c,days)=>call(owner,{action:'enroll',email:u.email,courseId:c,days});
const redeem=(u,value,status=200,hook)=>call(u,{action:'redeem',code:value},status,hook);
const used=async value=>{const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));const hash=Buffer.from(h).toString('hex');return base.prepare('SELECT * FROM codes WHERE hash=?').bind(hash).first();};
try{
 const courses=[];for(let i=0;i<3;i++)courses.push((await call(owner,{action:'save',kind:'course',data:{title:'Synthetic '+i,description:'',stage:'3',category:'Pharmacy',price:50000,days:180,status:'published',color:'teal'}})).data.id);
 const [c1,c2,c3]=courses;
 await enroll(a,c1,100);await enroll(a,c2,20);const before=await row(a,c1),otherBefore=await row(a,c2);const renewal=await code(c1);
 await redeem(a,renewal);assert.equal((await row(a,c1)).expires,before.expires+30*day,'100 remaining days + 30-day code must add all 30 days');assert.equal((await row(a,c2)).expires,otherBefore.expires);
 await redeem(a,renewal,400);await redeem(b,renewal,400);assert.equal((await row(a,c1)).expires,before.expires+30*day);assert.equal(await row(b,c1),null);
 const manualBefore=(await row(a,c1)).expires;await enroll(a,c1,30);assert.equal((await row(a,c1)).expires,manualBefore+30*day);
 console.log('PASS subscriptions: active/manual renewal, same/other-user replay, multiple-course isolation.');
 const expired=await code(c2,30);await base.prepare('UPDATE codes SET expires=? WHERE id=?').bind(Date.now()-1,(await used(expired)).id).run();await redeem(a,expired,400);assert.equal((await used(expired)).used_by,null);await redeem(a,'FK-NOT-A-CODE',400);
 await base.prepare('UPDATE enrollments SET expires=? WHERE id=?').bind(Date.now()-day,(await row(a,c2)).id).run();const fresh=await code(c2,30),start=Date.now();await redeem(a,fresh);assert.ok((await row(a,c2)).expires>=start+30*day&&(await row(a,c2)).expires<=Date.now()+30*day);
 const newCode=await code(c3,7);await redeem(a,newCode);assert.ok((await row(a,c3)).expires>Date.now()+6*day);
 const stopped=await row(a,c2);await call(owner,{action:'revoke',id:stopped.id});const blocked=await code(c2);await redeem(a,blocked,403);assert.equal((await row(a,c2)).expires,0);assert.equal((await used(blocked)).used_by,null);
 await enroll(a,c2,1);await redeem(a,blocked);assert.ok((await row(a,c2)).expires>Date.now()+30*day,'owner can explicitly restore, then code extends');
 const rollbackCode=await code(c1),prior=await row(a,c1);let fault=false;const original=console.error;console.error=()=>{};
 try{await redeem(a,rollbackCode,500,async e=>{if(e.query.startsWith('UPDATE codes')){fault=true;throw Error('synthetic post-claim failure');}});}finally{console.error=original;}
 assert.ok(fault);assert.equal((await row(a,c1)).expires,prior.expires);assert.equal((await used(rollbackCode)).used_by,null);await redeem(a,rollbackCode);assert.equal((await row(a,c1)).expires,prior.expires+30*day);
 const failedClaim=await code(c1),claimBefore=(await row(a,c1)).expires;
 await redeem(a,failedClaim,409,async e=>{if(e.query.startsWith('UPDATE codes'))e.result.meta.changes=0;});
 assert.equal((await row(a,c1)).expires,claimBefore);assert.equal((await used(failedClaim)).used_by,null,'failed claim must roll back both writes');
 console.log('PASS subscriptions: expired/new enrollment, expired/invalid code, explicit revocation, full rollback after claim, safe retry after failed transaction.');
 // Payment review must keep issuing a course-specific bearer code, not enroll
 // a student or change existing course price/payment policy.
 await call(a,{action:'order',courseId:c3,reference:'synthetic-reference'});const orders=(await base.prepare("SELECT * FROM records WHERE kind='order'").all()).results;const order=orders.find(o=>JSON.parse(o.data).userId===a.userId);const paidBefore=await row(a,c3);const issued=(await call(owner,{action:'reviewOrder',id:order.id,status:'approved'})).data.code;
 assert.equal((await row(a,c3)).expires,paidBefore.expires);await call(owner,{action:'reviewOrder',id:order.id,status:'approved'},409);assert.equal((await used(issued)).course_id,c3);await redeem(a,issued);assert.equal((await row(a,c3)).expires,paidBefore.expires+180*day);
 if(postgres){
  const concurrent=await code(c1,10),initial=(await row(a,c1)).expires;
  const same=await Promise.all([redeem(a,concurrent,null),redeem(a,concurrent,null)]);assert.equal(same.filter(r=>r.status===200).length,1);assert.ok(same.every(r=>[200,400,409].includes(r.status)));assert.equal((await row(a,c1)).expires,initial+10*day);
  const x=await code(c1,10),y=await code(c1,20),baseline=(await row(a,c1)).expires;await Promise.all([redeem(a,x),redeem(a,y)]);assert.equal((await row(a,c1)).expires,baseline+30*day);
  const contested=await code(c3,5);let arrivals=0,release;const gate=new Promise(r=>release=r);const timeout=setTimeout(()=>release(),10000);const barrier=()=>{let once=false;return async e=>{if(!once&&e.query.startsWith('SELECT * FROM codes')){once=true;if(++arrivals===2){clearTimeout(timeout);release();}await gate;}};};
  const pa=await row(a,c3);const competing=await Promise.all([redeem(a,contested,null,barrier()),redeem(b,contested,null,barrier())]);assert.equal(competing.filter(r=>r.status===200).length,1);assert.ok(competing.every(r=>[200,400,409].includes(r.status)));
  const winner=(await used(contested)).used_by;if(winner===a.email){assert.equal((await row(a,c3)).expires,pa.expires+5*day);assert.equal(await row(b,c3),null);}else{assert.equal(winner,b.email);assert.equal((await row(a,c3)).expires,pa.expires);assert.ok(await row(b,c3));}
  assert.equal(arrivals,2,'both students must reach the coordinated claim');
  // A separate connection commits the owner's revoke after the code lookup.
  // The SERIALIZABLE grant must retry/deny, never overwrite that committed revoke.
  const revokedCode=await code(c2);let revoked=false;const {Pool}=await import('pg');const peer=new Pool({connectionString:process.env.FARMAKON_TEST_DATABASE_URL,max:1,ssl:false});
  try{await redeem(a,revokedCode,403,async e=>{if(!revoked&&e.query.startsWith('SELECT * FROM codes')){revoked=true;await peer.query('UPDATE farmakon.enrollments SET expires=0 WHERE email=$1 AND course_id=$2',[a.email,c2]);}});}finally{await peer.end();}
  assert.equal((await row(a,c2)).expires,0);assert.equal((await used(revokedCode)).used_by,null);
  console.log('PASS real PostgreSQL: two-device replay extends once, distinct codes preserve both durations, coordinated two-user claim has one winner and no wrong-course grant.');
 }else console.log('NOTE: concurrency skipped on SQLite; run same file with dedicated loopback PostgreSQL for proof.');
 console.log('PASS subscription/code regression; no production/Auth/Storage connection.');
}finally{await close();delete globalThis.__subscriptions;}
