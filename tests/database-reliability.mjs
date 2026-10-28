import fs from 'node:fs';import ts from 'typescript';import assert from 'node:assert/strict';
const compile=s=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText).toString('base64');
const pg=compile(`export const types={setTypeParser(){}};export class Pool{constructor(config){globalThis.__dbReliability.config=config;}async connect(){const s=globalThis.__dbReliability;s.connections++;const attempt=s.connections;return {async query(sql){s.events.push(sql);if(sql==='COMMIT'&&(s.mode==='always'||s.mode==='uncertain'||attempt===1)){const error=Error('synthetic commit failure');error.code=s.mode==='uncertain'?'08006':'40001';throw error;}return {rows:[],rowCount:0};},release(){s.events.push('release');s.released++;}};}}`);
const isolate=compile('export function assertPreviewIsolation(){}');const prior=process.env.DATABASE_URL,originalTimer=globalThis.setTimeout;
globalThis.__dbReliability={};
try{
 process.env.DATABASE_URL='postgresql://synthetic@127.0.0.1/not-connected';
 const source=fs.readFileSync('lib/database.ts','utf8').replace("import 'server-only';",'').replace("'./farmakon/preview-isolation'",JSON.stringify(isolate)).replace("'pg'",JSON.stringify(pg));
 const {database}=await import(compile(source));
 for(const mode of ['once','always','uncertain']){
  const state={mode,connections:0,released:0,events:[],delays:[]};globalThis.__dbReliability=state;
  globalThis.setTimeout=(fn,ms,...args)=>{assert.equal(state.events.at(-1),'release','never hold a connection during backoff');assert.ok(ms>=0&&ms<=640);state.delays.push(ms);return originalTimer(fn,0,...args)};
  if(mode==='once'){assert.equal(await database.transaction(async()=>42),42);assert.equal(state.connections,2);assert.equal(state.delays.length,1);assert.equal(state.config.max,3);assert.equal(state.config.ssl.rejectUnauthorized,true);}
  if(mode==='always'){await assert.rejects(()=>database.transaction(async()=>42),e=>e.code==='40001');assert.equal(state.connections,5);assert.equal(state.delays.length,4);}
  if(mode==='uncertain'){await assert.rejects(()=>database.transaction(async()=>42),e=>e.code==='08006');assert.equal(state.connections,1);assert.equal(state.delays.length,0);}
  assert.equal(state.connections,state.released);
 }
 console.log('PASS F00.7: known rollback retries bounded at five; connections released before jitter; uncertain COMMIT not retried; TLS and pool max unchanged. Driver transport fixtures.');
}finally{globalThis.setTimeout=originalTimer;if(prior===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=prior;delete globalThis.__dbReliability;}
