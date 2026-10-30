// Actual adapter, driver fault fixtures. No database or provider connection.
import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const compile=s=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText).toString('base64');
const pg=compile(`export const types={setTypeParser(){}};export class Pool{async connect(){const s=globalThis.__rollbackTest;const n=++s.acquired;return {async query(sql){s.events.push(sql);if(sql==='ROLLBACK'&&s.badRollback&&n===1)throw Error('rollback unavailable');return {rows:[],rowCount:0};},release(discard){s.releases.push(!!discard);}};}}`);
const source=fs.readFileSync('lib/database.ts','utf8').replace("import 'server-only';",'').replace("'./farmakon/preview-isolation'",JSON.stringify(compile('export function assertPreviewIsolation(){}'))).replace("'pg'",JSON.stringify(pg));
const previous=process.env.DATABASE_URL;
try{
 process.env.DATABASE_URL='postgresql://fixture@127.0.0.1/not-connected';
 const {database}=await import(compile(source));
 for(const scenario of [{code:'22012',badRollback:false,discard:false},{code:'22012',badRollback:true,discard:true},{code:'08006',badRollback:false,discard:true},{code:'40001',badRollback:true,discard:true},{code:'40P01',badRollback:false,discard:false}]){
  const s={...scenario,acquired:0,releases:[],events:[]};globalThis.__rollbackTest=s;
  const original=Object.assign(Error('synthetic transaction error'),{code:s.code});let work=0;
  const result=database.transaction(async()=>{if(++work===1)throw original;return 42;});
  if(['40001','40P01'].includes(s.code)){assert.equal(await result,42);assert.equal(work,2);}else{await assert.rejects(()=>result,e=>e===original);assert.equal(work,1);}
  assert.equal(s.releases[0],s.discard,'failed rollback/connection must discard the client');
  assert.equal(s.releases.length,s.acquired,'every acquired client is released exactly once');
  assert.equal(s.events[0],'BEGIN ISOLATION LEVEL SERIALIZABLE');
 }
 console.log('PASS P0-A: failed rollback/connection discards pool client, original error preserved, only known aborts retry, SERIALIZABLE retained. Driver faults, not live PG failure evidence.');
}finally{if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;delete globalThis.__rollbackTest;}
