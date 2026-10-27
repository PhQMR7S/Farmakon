import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const compile=source=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText).toString('base64');
let user=null,calls=[],sessionToken=null,verifiedToken,providerError=null,sessionActive=true,sessionFailure=false,sessionChecks=0;
globalThis.__farmAuth={auth:{async getSession(){return {data:{session:sessionToken?{access_token:sessionToken,user:{id:'untrusted-cookie-user'}}:null},error:null}},async getUser(token){verifiedToken=token;return {data:{user},error:providerError}},async signInWithPassword(){calls.push('login');return {error:null}},async signUp(){calls.push('signup');return {error:null}},async resetPasswordForEmail(){calls.push('forgot');return {error:null}},async updateUser(){calls.push('reset');return {error:null}},async signOut(){calls.push('logout');return {error:null}}}};
globalThis.__farmSessionDB={prepare(query){assert.equal(query,'SELECT farmakon.session_is_active(?,?) AS active');return {bind(sid,uid){assert.equal(sid,'00000000-0000-4000-8000-000000000001');assert.equal(uid,user.id);return this},async first(){sessionChecks++;if(sessionFailure)throw Error('fixture unavailable');return {active:sessionActive}}}}};
const client=compile('export async function authClient(){return globalThis.__farmAuth}');
const gateURL=compile(fs.readFileSync('lib/farmakon/privacy/gate.ts','utf8').replace("import {assertPreviewIsolation} from '../preview-isolation';","const assertPreviewIsolation=()=>{throw Error('fixture gate requires isolated config')};"));
const serverURL=compile(fs.readFileSync('app/lib/server.ts','utf8').replace(/^import .*;$/gm,'')+`\nconst {deletionEnabled}=await import(${JSON.stringify(gateURL)});const database=globalThis.__farmSessionDB,storage={};const {authClient}=await import(${JSON.stringify(client)});`);
const server=await import(serverURL);
process.env.FARMAKON_OWNER_EMAIL='owner@example.test';
await assert.rejects(()=>server.identity(),/AUTH/);
user={id:'fake',email:'student@example.test',email_confirmed_at:null,user_metadata:{role:'owner'}};
await assert.rejects(()=>server.identity(),/AUTH/);
user.email_confirmed_at='2026-01-01';assert.equal(await server.owner(await server.identity()),false);
user={...user,email:'OWNER@example.test'};assert.equal(await server.owner(await server.identity()),true);
process.env.FARMAKON_STRICT_SESSIONS_ENABLED='true';
await assert.rejects(()=>server.identity(),/AUTH/);
const fixtureToken=claims=>'fixture.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.fixture';
sessionToken=fixtureToken({sub:user.id,session_id:'00000000-0000-4000-8000-000000000001'});
assert.equal((await server.identity()).userId,user.id);assert.equal(verifiedToken,sessionToken);assert.equal(sessionChecks,1);
sessionActive=false;await assert.rejects(()=>server.identity(),/^Error: AUTH$/);
sessionActive=true;sessionFailure=true;await assert.rejects(()=>server.identity(),/SESSION_CHECK_UNAVAILABLE/);sessionFailure=false;
const checksBefore=sessionChecks;providerError={message:'invalid fixture signature'};await assert.rejects(()=>server.identity(),/AUTH/);assert.equal(sessionChecks,checksBefore);providerError=null;
sessionToken=fixtureToken({sub:'another-user',session_id:'00000000-0000-4000-8000-000000000001'});await assert.rejects(()=>server.identity(),/AUTH/);assert.equal(sessionChecks,checksBefore);
sessionToken=fixtureToken({sub:user.id,session_id:'malformed'});await assert.rejects(()=>server.identity(),/AUTH/);assert.equal(sessionChecks,checksBefore);
delete process.env.FARMAKON_STRICT_SESSIONS_ENABLED;
console.log('PASS: strict session gate verifies the exact token first; rejects missing/revoked/mismatched sessions and fails closed on database outage. Provider and session transport are fixtures.');
const testDB=compile('export const database={};');
const rate=compile(fs.readFileSync('lib/farmakon/rate-limit.ts','utf8').replace("'../database'",JSON.stringify(testDB)));
const http=compile(fs.readFileSync('lib/http.ts','utf8'));
const route=await import(compile(fs.readFileSync('app/api/auth/route.ts','utf8').replace("'../../../lib/supabase/server'",JSON.stringify(client)).replace("'../../lib/server'",JSON.stringify(serverURL)).replace("'zod'",JSON.stringify(import.meta.resolve('zod'))).replace("'../../../lib/http'",JSON.stringify(http)).replace("'../../../lib/farmakon/rate-limit'",JSON.stringify(rate))));
async function post(body,origin='https://farm.test'){return route.POST(new Request('https://farm.test/api/auth',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)}))}
assert.equal((await post({action:'logout'},'https://evil.test')).status,403);assert.deepEqual(calls,[]);
assert.equal((await post({action:'signup',email:'bad',password:'short',name:'x'})).status,400);assert.deepEqual(calls,[]);
user=null;assert.equal((await post({action:'reset',password:'long-test-password'})).status,401);assert.deepEqual(calls,[]);
assert.equal((await post({action:'forgot',email:'unknown@example.test'})).status,200);assert.deepEqual(calls,['forgot']);
const result=await post({action:'logout'});assert.equal(result.status,200);assert.match(result.headers.get('cache-control'),/no-store/);
console.log('PASS: verified email identity, metadata cannot grant owner, CSRF, malformed signup, unauthenticated reset, generic recovery, no-store logout. Auth transport stubbed; live delivery unverified.');

process.env.FARMAKON_RATE_LIMIT_ENABLED='true';delete process.env.FARMAKON_RATE_LIMIT_SECRET;
const countBefore=calls.length;assert.equal((await post({action:'login',email:'student@example.test',password:'fixture-password'})).status,503);assert.equal(calls.length,countBefore);
delete process.env.FARMAKON_RATE_LIMIT_ENABLED;
const {requestSubject}=await import(rate);process.env.VERCEL='1';
assert.equal(requestSubject(new Request('https://farm.test',{headers:{'x-forwarded-for':'1.2.3.4'}})),'unresolved-client');
assert.equal(requestSubject(new Request('https://farm.test',{headers:{'x-vercel-forwarded-for':'1.2.3.4'}})),'1.2.3.4');
delete process.env.VERCEL;
console.log('PASS: enabled limiter fails closed before provider call; untrusted forwarded header is ignored.');

// Strengthened new-password policy must not lock out legacy provider credentials.
calls=[];
assert.equal((await post({action:'login',email:'student@example.test',password:'old-pass'})).status,200);
assert.deepEqual(calls,['login']);
calls=[];assert.equal((await post({action:'signup',email:'student@example.test',password:'old-pass',name:'Test Student'})).status,400);assert.deepEqual(calls,[]);
console.log('PASS: legacy credentials reach Auth; new signup passwords still require 10 characters.');

// A reset is sensitive: require a verified, confirmed and active identity even
// if provider getUser can still describe a previously issued access token.
user={id:'fixture-user',email:'student@example.test',email_confirmed_at:'2026-01-01',user_metadata:{}};
process.env.FARMAKON_STRICT_SESSIONS_ENABLED='true';
sessionToken=fixtureToken({sub:user.id,session_id:'00000000-0000-4000-8000-000000000001'});
calls=[];sessionActive=false;assert.equal((await post({action:'reset',password:'valid-test-password'})).status,401);assert.deepEqual(calls,[]);
sessionActive=true;sessionFailure=true;assert.equal((await post({action:'reset',password:'valid-test-password'})).status,503);assert.deepEqual(calls,[]);sessionFailure=false;
providerError={message:'private provider detail'};assert.equal((await post({action:'reset',password:'valid-test-password'})).status,401);assert.deepEqual(calls,[]);providerError=null;
user.email_confirmed_at=null;assert.equal((await post({action:'reset',password:'valid-test-password'})).status,401);assert.deepEqual(calls,[]);
user.email_confirmed_at='2026-01-01';assert.equal((await post({action:'reset',password:'valid-test-password'})).status,200);assert.deepEqual(calls,['reset']);
calls=[];assert.equal((await post({action:'reset',password:'old-pass'})).status,400);assert.deepEqual(calls,[]);
delete process.env.FARMAKON_STRICT_SESSIONS_ENABLED;
console.log('PASS: reset validates active exact-token identity and rejects revoked/unconfirmed/provider-error/outage cases before password update. Transport is a fixture.');
