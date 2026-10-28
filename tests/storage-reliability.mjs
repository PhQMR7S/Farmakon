import fs from 'node:fs';import ts from 'typescript';import assert from 'node:assert/strict';
const compile=s=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText).toString('base64');
const provider=compile(`export async function authClient(){return {storage:{from(){return {async createSignedUrl(){return {data:{signedUrl:'https://storage.example.test/fixture?token=not-a-real-token'},error:null}}}}}}}`);
const {storage}=await import(compile(fs.readFileSync('lib/storage.ts','utf8').replace("import 'server-only';",'').replace("'./supabase/server'",JSON.stringify(provider))));
const originalFetch=globalThis.fetch,originalTimer=globalThis.setTimeout;let canceled=false;
try{
 globalThis.fetch=async()=>new Response(new ReadableStream({cancel(){canceled=true}}),{status:503});await assert.rejects(()=>storage.get('synthetic'),/STORAGE_UNAVAILABLE/);assert.equal(canceled,true);
 globalThis.fetch=async()=>new Response(null,{status:404});assert.equal(await storage.get('synthetic'),null);
 let captured;globalThis.fetch=async(url,options)=>{captured=options;return new Response('%PDF-fixture',{headers:{'content-length':'12'}})};
 const file=await storage.get('synthetic');assert.equal(file.size,12);assert.equal(await new Response(file.body).text(),'%PDF-fixture');assert.equal(captured.cache,'no-store');assert.equal(captured.signal.aborted,false);
 globalThis.setTimeout=(fn,ms,...args)=>originalTimer(fn,ms===15000?0:ms,...args);
 globalThis.fetch=async(url,options)=>new Promise((resolve,reject)=>{options.signal.addEventListener('abort',()=>reject(Error('fixture-header-timeout')),{once:true})});await assert.rejects(()=>storage.get('synthetic'),/fixture-header-timeout/);
 globalThis.setTimeout=originalTimer;const client=new AbortController();globalThis.fetch=async(url,options)=>new Promise((resolve,reject)=>{options.signal.addEventListener('abort',()=>reject(Error('fixture-client-abort')),{once:true})});const request=storage.get('synthetic',{signal:client.signal});const rejected=assert.rejects(request,/fixture-client-abort/);await new Promise(r=>originalTimer(r,0));client.abort();await rejected;
 console.log('PASS F00.7: Storage 503 is not mislabeled 404; error bodies canceled, no-store stream preserved, bounded header wait and client abort. Provider transport fixtures.');
}finally{globalThis.fetch=originalFetch;globalThis.setTimeout=originalTimer;}
