import fs from 'node:fs';import ts from 'typescript';import assert from 'node:assert/strict';
const source=fs.readFileSync('lib/farmakon/preview-isolation.ts','utf8');
const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {assertPreviewIsolation}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const ref='qfzharpouemueipsrduv',prod='zviqtacbsprewyxrmpbb';
const valid={VERCEL_ENV:'preview',NEXT_PUBLIC_SUPABASE_URL:`https://${ref}.supabase.co`,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'fixture-only-publishable',DATABASE_URL:`postgresql://farmakon_app.${ref}:fixture-password@aws-1-eu-central-1.pooler.supabase.com:6543/postgres`,FARMAKON_STRICT_SESSIONS_ENABLED:'true',FARMAKON_RATE_LIMIT_ENABLED:'true',FARMAKON_RATE_LIMIT_SECRET:'fixture-only-secret-at-least-32-characters'};
assert.doesNotThrow(()=>assertPreviewIsolation(valid));
assert.doesNotThrow(()=>assertPreviewIsolation({...valid,DATABASE_URL:`postgresql://farmakon_app:fixture-password@db.${ref}.supabase.co:5432/postgres`}));
for(const patch of [
 {DATABASE_URL:valid.DATABASE_URL.replace(ref,prod)},
 {NEXT_PUBLIC_SUPABASE_URL:`https://${prod}.supabase.co`},
 {NEXT_PUBLIC_SUPABASE_URL:`https://${ref}.supabase.co.evil.test`},
 {DATABASE_URL:valid.DATABASE_URL.replace('pooler.supabase.com','pooler.supabase.com.evil.test')},
 {DATABASE_URL:valid.DATABASE_URL+'?sslmode=disable'},
 {DATABASE_URL:''},{NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:''},
 {FARMAKON_STRICT_SESSIONS_ENABLED:'false'},{FARMAKON_RATE_LIMIT_ENABLED:'false'},{FARMAKON_RATE_LIMIT_SECRET:'short'}
])assert.throws(()=>assertPreviewIsolation({...valid,...patch}),/^Error: PREVIEW_ISOLATION_REQUIRED$/);
assert.doesNotThrow(()=>assertPreviewIsolation({VERCEL_ENV:'production'}),'No production behavior change');
assert.doesNotThrow(()=>assertPreviewIsolation({}),'Loopback CI remains provider-free');
console.log('PASS: preview rejects mixed/production/missing endpoints and disabled guards before network use; production/local unaffected.');
// Exercise each real entry point with constructor/cookie traps: a bad preview
// must fail before Auth, DB, or proxy provider transport is instantiated.
const guardURL='data:text/javascript;base64,'+Buffer.from(code).toString('base64');
const moduleURL=s=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText).toString('base64');
process.env.VERCEL_ENV='preview';delete process.env.DATABASE_URL;delete process.env.NEXT_PUBLIC_SUPABASE_URL;
const authSource=fs.readFileSync('lib/supabase/server.ts','utf8').replace("import 'server-only';",'').replace("'../farmakon/preview-isolation'",JSON.stringify(guardURL)).replace("import {createServerClient} from '@supabase/ssr';","const createServerClient=()=>{throw Error('PROVIDER_CONTACTED')};").replace("import {cookies} from 'next/headers';","const cookies=()=>{throw Error('COOKIES_CONTACTED')};");
await assert.rejects(()=>(import(moduleURL(authSource))).then(m=>m.authClient()),/^Error: PREVIEW_ISOLATION_REQUIRED$/);
const dbSource=fs.readFileSync('lib/database.ts','utf8').replace("import 'server-only';",'').replace("'./farmakon/preview-isolation'",JSON.stringify(guardURL)).replace("from 'pg'",`from ${JSON.stringify(import.meta.resolve('pg'))}`);
await assert.rejects(()=>(import(moduleURL(dbSource))).then(m=>m.database.prepare('SELECT 1').all()),/^Error: PREVIEW_ISOLATION_REQUIRED$/);
const proxySource=fs.readFileSync('proxy.ts','utf8').replace("'./lib/farmakon/preview-isolation'",JSON.stringify(guardURL)).replace("import {createServerClient} from '@supabase/ssr';","const createServerClient=()=>{throw Error('PROVIDER_CONTACTED')};").replace("import {NextResponse,type NextRequest} from 'next/server';","const NextResponse={json:Response.json,next(){throw Error('PASSTHROUGH')}};");
const proxied=await(await import(moduleURL(proxySource))).proxy({});assert.equal(proxied.status,503);assert.match(proxied.headers.get('cache-control'),/no-store/);
delete process.env.VERCEL_ENV;
console.log('PASS: actual Auth client, database adapter and proxy reject unsafe preview before provider/cookie/SQL calls.');
