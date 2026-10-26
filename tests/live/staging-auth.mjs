// Opt-in provider tests. Never run by ordinary CI; never accepts production.
// Credentials must be supplied by a secure local/CI secret store, never committed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createServerClient} from '@supabase/ssr';
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
const accounts=JSON.parse(process.env.FARMAKON_LIVE_ACCOUNTS_JSON||'{}');
for(const role of ['owner','a','b']){
 const account=accounts[role];assert.ok(account?.email?.startsWith('f00-e2e-')&&account?.password,'Use dedicated f00-e2e- accounts, never personal identities');
}
function session(){
 const cookies=new Map();const client=createServerClient(api,key,{cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll(items){for(const {name,value} of items)cookies.set(name,value);}}});
 return {client,cookie:()=>[...cookies].map(([k,v])=>`${k}=${v}`).join('; ')};
}
async function login(role){const s=session();const {data,error}=await s.client.auth.signInWithPassword(accounts[role]);assert.equal(error,null,'Staging sign-in failed');assert.ok(data.user?.email_confirmed_at,'Account must be genuinely confirmed');assert.equal(data.user.app_metadata?.farmakon_test_fixture,true,'Provider-admin fixture marker required; never mutate ordinary users');const ready={...s,id:data.user.id};signed.push(ready);return ready;}
async function call(s,path='/api/platform',body,cookie=s.cookie()){
 const headers={Cookie:cookie};if(process.env.FARMAKON_LIVE_VERCEL_OIDC)headers['x-vercel-trusted-oidc-idp-token']=process.env.FARMAKON_LIVE_VERCEL_OIDC;
 if(body){headers.Origin=origin.origin;headers['Content-Type']='application/json';}
 return fetch(new URL(path,origin),{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,redirect:'error'});
}
const signed=[];
try{
 const owner=await login('owner'),a=await login('a'),b=await login('b'),aDevice2=await login('a');
 assert.equal(new Set([owner.id,a.id,b.id]).size,3,'Auth identities must differ');
 const states=[];for(const s of [owner,a,b]){const r=await call(s);assert.equal(r.status,200,'Protected Preview must be accessible without weakening protection');states.push(await r.json());}
 assert.equal(states[0].user.admin,true);assert.equal(states[1].user.admin,false);assert.equal(states[2].user.admin,false);
 for(const [i,s] of [[1,a],[2,b]]){
  assert.equal(states[i].user.id,s.id);for(const key of ['members','codes','audit'])assert.equal(states[i][key],undefined);
  assert.ok(states[i].activity.every(row=>row.user_id===s.id));assert.ok(states[i].attempts.every(row=>row.userId===s.id));
 }
 console.log('PASS live: three distinct confirmed provider users; owner/student role separation and response ownership. Empty collections are not cross-user data-isolation proof.');
 const prior=(await a.client.auth.getUser()).data.user.user_metadata;
 try{
  assert.equal((await a.client.auth.updateUser({data:{role:'owner',admin:true}})).error,null);
  const state=await(await call(a)).json();assert.equal(state.user.admin,false);
 }finally{await a.client.auth.updateUser({data:{...prior,role:prior.role??null,admin:prior.admin??null}});}
 console.log('PASS live: editable user metadata does not grant owner.');
 const oldCookie=a.cookie();assert.equal((await a.client.auth.signOut({scope:'local'})).error,null);
 assert.equal((await call(a,'/api/platform',undefined,oldCookie)).status,401,'Revoked old cookie must fail strict guard');
 assert.equal((await call(aDevice2)).status,200,'Local logout must preserve second device by existing policy');
 const secondOldCookie=aDevice2.cookie();
 assert.equal((await aDevice2.client.auth.signOut({scope:'global'})).error,null);
 assert.equal((await call(aDevice2,'/api/platform',undefined,secondOldCookie)).status,401,'Global logout must revoke the remaining second device');
 assert.equal((await call(a,'/api/platform',undefined,oldCookie)).status,401);
 console.log('PASS live: two devices, local/global sign-out and stale-cookie rejection on platform API.');
 console.log('NOT TESTED by this script: signup/email delivery/reset/password-change, populated A/B data, media/entitlement changes, token expiry and all sensitive routes. Complete the separate manual matrix.');
}finally{for(const s of signed)try{await s.client.auth.signOut({scope:'local'});}catch{}}

}
main().catch(()=>{console.error('BLOCKED/FAILED live Staging Auth: verify fixture credentials, admin marker, protected preview and the manual matrix. Secret-bearing error details intentionally withheld.');process.exitCode=1;});
