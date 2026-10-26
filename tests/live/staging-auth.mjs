// Opt-in provider tests. Never run by ordinary CI; never accepts production.
// Credentials must be supplied by a secure local/CI secret store, never committed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomBytes} from 'node:crypto';
import {verifyEntitlements} from './entitlements.mjs';
import {createServerClient} from '@supabase/ssr';
let stage='configuration';
async function main(){
const ref='qfzharpouemueipsrduv';
const api=process.env.FARMAKON_LIVE_SUPABASE_URL;
assert.equal(api,`https://${ref}.supabase.co`,'Only the pinned isolated Staging project is accepted');
assert.equal(process.env.FARMAKON_LIVE_DISPOSABLE,'confirmed-staging-fixtures-only','Explicit disposable-fixture opt-in required');
const origin=new URL(process.env.FARMAKON_LIVE_PREVIEW_URL);
assert.equal(origin.protocol,'https:');assert.ok(origin.hostname.startsWith('farmakon-')&&origin.hostname.endsWith('-phqmr7s.vercel.app'));
assert.equal(origin.pathname,'/');assert.equal(origin.search,'');assert.equal(origin.hash,'');assert.equal(origin.username,'');
const target=JSON.parse(fs.readFileSync(new URL('./staging-target.json',import.meta.url),'utf8'));
assert.equal(target.projectRef,ref);assert.equal(target.branch,'audit/f00-regression-2026-10-26');
assert.ok(target.previewOrigin,'No reviewed protected Preview registered yet');assert.equal(origin.origin,target.previewOrigin,'Never send cookies to unreviewed or Production deployments');
const key=process.env.FARMAKON_LIVE_PUBLISHABLE_KEY;assert.ok(key,'Staging publishable key required');
let protectionCookie='';
if(process.env.FARMAKON_LIVE_VERCEL_SHARE){
 stage='preview-protection';const access=new URL('/api/health',origin);access.searchParams.set('_vercel_share',process.env.FARMAKON_LIVE_VERCEL_SHARE);
 const grant=await fetch(access,{redirect:'manual',signal:AbortSignal.timeout(30000)});
 const redirect=grant.headers.get('location');if(redirect)assert.equal(new URL(redirect,origin).origin,origin.origin,'Never follow access links off the reviewed Preview');
 protectionCookie=grant.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');assert.ok(protectionCookie,'Scoped Preview access cookie required');
}
const accounts=JSON.parse(process.env.FARMAKON_LIVE_ACCOUNTS_JSON||'{}');
for(const role of ['owner','a','b']){
 const account=accounts[role];assert.ok(account?.email?.startsWith('f00-e2e-')&&account?.password,'Use dedicated f00-e2e- accounts, never personal identities');
}
function session(){
 const cookies=new Map();const client=createServerClient(api,key,{cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll(items){for(const {name,value} of items)cookies.set(name,value);}}});
 return {client,cookie:()=>[...cookies].map(([k,v])=>`${k}=${v}`).join('; ')};
}
async function login(role){stage='provider-login-'+role;const s=session();const {data,error}=await s.client.auth.signInWithPassword(accounts[role]);assert.equal(error,null,'Staging sign-in failed');assert.ok(data.user?.email_confirmed_at,'Account must be genuinely confirmed');assert.equal(data.user.app_metadata?.farmakon_test_fixture,true,'Provider-admin fixture marker required; never mutate ordinary users');const ready={...s,id:data.user.id};signed.push(ready);return ready;}
async function call(s,path='/api/platform',body,cookie=s.cookie(),raw){
 const headers={Cookie:[protectionCookie,cookie].filter(Boolean).join('; ')};if(process.env.FARMAKON_LIVE_VERCEL_OIDC)headers['x-vercel-trusted-oidc-idp-token']=process.env.FARMAKON_LIVE_VERCEL_OIDC;
 if(body||raw){headers.Origin=origin.origin;headers['Content-Type']=raw?.mime||'application/json';}
 return fetch(new URL(path,origin),{method:body||raw?'POST':'GET',headers,body:raw?.bytes||(body?JSON.stringify(body):undefined),redirect:'error',signal:AbortSignal.timeout(30000)});
}
const signed=[];
try{
 const owner=await login('owner'),a=await login('a'),b=await login('b');let aDevice2=await login('a');
 assert.equal(new Set([owner.id,a.id,b.id]).size,3,'Auth identities must differ');
 const states=[];for(const [index,s] of [owner,a,b].entries()){stage='preview-read-'+index;const r=await call(s);assert.equal(r.status,200,'Protected Preview must be accessible without weakening protection');states.push(await r.json());}
 assert.equal(states[0].user.admin,true);assert.equal(states[1].user.admin,false);assert.equal(states[2].user.admin,false);
 for(const [i,s] of [[1,a],[2,b]]){
  assert.equal(states[i].user.id,s.id);for(const key of ['members','codes','audit'])assert.equal(states[i][key],undefined);
  assert.ok(states[i].activity.every(row=>row.user_id===s.id));assert.ok(states[i].attempts.every(row=>row.userId===s.id));
 }
 console.log('PASS live: three distinct admin-confirmed provider users; server-side owner/student roles. Populated data isolation is checked separately below.');
 const prior=(await a.client.auth.getUser()).data.user.user_metadata;
 try{
  assert.equal((await a.client.auth.updateUser({data:{role:'owner',admin:true}})).error,null);
  const state=await(await call(a)).json();assert.equal(state.user.admin,false);
 }finally{await a.client.auth.updateUser({data:{...prior,role:prior.role??null,admin:prior.admin??null}});}
 console.log('PASS live: editable user metadata does not grant owner.');
 stage='live-entitlements';
 const fixture=await verifyEntitlements({owner,a,b,accounts,call,upload:async(s,courseId)=>{const r=await call(s,'/api/media?courseId='+encodeURIComponent(courseId)+'&name=f00-synthetic.pdf',null,s.cookie(),{mime:'application/pdf',bytes:new TextEncoder().encode('%PDFtest')});assert.equal(r.status,200);return r.json();}});
 stage='password-change';
 const originalPassword=accounts.a.password;
 try{
  assert.equal((await a.client.auth.updateUser({password:randomBytes(32).toString('hex')})).error,null,'Fixture password change');
  assert.equal((await call(a)).status,200,'Current session remains valid after password change');
  assert.equal((await call(aDevice2)).status,401,'Other session revoked after password change');
 }finally{assert.equal((await a.client.auth.updateUser({password:originalPassword})).error,null,'Restore fixture password');}
 console.log('PASS live: changing fixture password preserves current session and revokes the other device; original fixture password restored.');
 aDevice2=await login('a');
 stage='local-session-revocation';
 const oldCookie=a.cookie();assert.equal((await a.client.auth.signOut({scope:'local'})).error,null);
 assert.equal((await call(a,'/api/platform',undefined,oldCookie)).status,401,'Revoked old cookie must fail strict guard');
 for(const [path,body] of [['/api/platform',{action:'ticket',title:'F00 blocked',description:'Must never be written'}],['/api/account/export',{}],[fixture.media,undefined]])assert.equal((await call(a,path,body,oldCookie)).status,401,'Sensitive routes reject revoked sessions');
 stage='revoked-session-password-reset';const reset=await call(a,'/api/auth',{action:'reset',password:accounts.a.password},oldCookie);assert.ok([400,401,403].includes(reset.status),'Revoked session must never change a password');
 stage='second-device-local-survival';
 assert.equal((await call(aDevice2)).status,200,'Local logout must preserve second device by existing policy');
 const secondOldCookie=aDevice2.cookie();
 assert.equal((await aDevice2.client.auth.signOut({scope:'global'})).error,null);
 assert.equal((await call(aDevice2,'/api/platform',undefined,secondOldCookie)).status,401,'Global logout must revoke the remaining second device');
 assert.equal((await call(a,'/api/platform',undefined,oldCookie)).status,401);
 console.log('PASS live: two devices, local/global sign-out and stale-cookie rejection on platform API.');
 if(process.env.FARMAKON_LIVE_EXPIRY_DIR){
  stage='provider-session-expiry';const dir=process.env.FARMAKON_LIVE_EXPIRY_DIR;assert.ok(dir.startsWith('/tmp/farmakon-expiry-'));
  fs.writeFileSync(dir+'/ready.json',JSON.stringify({fixtureUserId:b.id}),{mode:0o600});
  const limit=Date.now()+120000;while(!fs.existsSync(dir+'/expired')){assert.ok(Date.now()<limit,'Expiry coordinator timed out');await new Promise(r=>setTimeout(r,250));}
  assert.equal((await call(b)).status,401);assert.equal((await call(b,fixture.media)).status,401);assert.equal((await call(b,'/api/account/export',{})).status,401);
  console.log('PASS live: actual provider session not_after expiration denies platform, media and export without changing JWT clock/signature.');
 }
 console.log('NOT TESTED by this script: delivered signup/recovery emails, recovery callback and natural token expiry. Admin-confirmed fixtures are not email-delivery evidence.');
}finally{for(const s of signed)try{await s.client.auth.signOut({scope:'local'});}catch{}}

}
main().catch(e=>{console.error(JSON.stringify({result:'BLOCKED/FAILED live Staging Auth',stage,actualStatus:typeof e.actual==='number'?e.actual:undefined,expectedStatus:typeof e.expected==='number'?e.expected:undefined}));process.exitCode=1;});
