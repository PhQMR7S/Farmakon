import fs from 'node:fs';import ts from 'typescript';import assert from 'node:assert/strict';
const moduleURL=s=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText).toString('base64');
let calls=0,fail=false,limit=null,limitFailure=false;const used=new Set();
globalThis.__f003Callback={auth:{async exchangeCodeForSession(code){calls++;const error=fail||used.has(code);used.add(code);return {error:error?{message:'DO_NOT_LEAK_PROVIDER_DETAIL'}:null};}}};
const client=moduleURL('export async function authClient(){return globalThis.__f003Callback}');
const limiter=moduleURL('export const requestSubject=()=>"fixture";export async function limitRequest(){if(globalThis.__f003LimitFailure)throw Error("RATE_LIMIT_UNAVAILABLE");return globalThis.__f003LimitResponse||null;}');
const next=moduleURL('export const NextResponse={redirect:url=>new Response(null,{status:307,headers:{Location:String(url)}})};');
const source=fs.readFileSync('app/auth/callback/route.ts','utf8').replace("'../../../lib/supabase/server'",JSON.stringify(client)).replace("'next/server'",JSON.stringify(next)).replace("'../../../lib/farmakon/rate-limit'",JSON.stringify(limiter));
const {GET}=await import(moduleURL(source));
async function callback(query){const r=await GET(new Request('https://farm.test/auth/callback'+query));assert.match(r.headers.get('cache-control'),/private.*no-store/);assert.equal(r.headers.get('referrer-policy'),'no-referrer');return r;}
let r=await callback('');assert.equal(r.headers.get('location'),'https://farm.test/login?auth_error=callback');assert.equal(calls,0);
for(const query of ['?code=&error=expired','?code=a&code=b','?code='+ 'x'.repeat(2049),'?code=a%20b','?code=a&error=access_denied&error_description=DO_NOT_LEAK']){r=await callback(query);assert.equal(r.headers.get('location'),'https://farm.test/login?auth_error=callback');assert.equal(calls,0);}
r=await callback('?code=valid&next=/reset-password');assert.equal(r.headers.get('location'),'https://farm.test/reset-password');
r=await callback('?code=valid&next=/reset-password');assert.equal(r.headers.get('location'),'https://farm.test/login?auth_error=callback','Consumed code rejected by provider fixture');
fail=true;r=await callback('?code=expired');assert.equal(r.headers.get('location'),'https://farm.test/login?auth_error=callback');fail=false;
for(const [i,nextValue] of ['https://evil.test','//evil.test','/\\evil.test','/reset-password?next=https://evil.test','%2f%2fevil.test'].entries()){
 r=await callback('?code=safe-'+i+'&next='+encodeURIComponent(nextValue));assert.equal(r.headers.get('location'),'https://farm.test/');assert.ok(!JSON.stringify([...r.headers]).includes('DO_NOT_LEAK'));
}
const before=calls;globalThis.__f003LimitResponse=Response.json({error:'limited'},{status:429});r=await callback('?code=limited');assert.equal(r.status,429);assert.equal(calls,before);globalThis.__f003LimitResponse=null;
globalThis.__f003LimitFailure=true;r=await callback('?code=outage');assert.equal(r.headers.get('location'),'https://farm.test/login?auth_error=callback');assert.equal(calls,before);
console.log('PASS: actual callback route validates code shape, fixed same-origin targets, no-store/no-referrer, generic invalid/consumed/expired failures and quota fail-closed. Provider exchange is a fixture; real email/link consumption unverified.');
