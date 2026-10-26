import assert from 'node:assert/strict';import fs from 'node:fs';import ts from 'typescript';
const code=ts.transpileModule(fs.readFileSync('lib/http.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {readBytes,readJson}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const request=(body,headers={})=>new Request('https://test.invalid',{method:'POST',body,headers,duplex:'half'});
await assert.rejects(()=>readJson(request('x'.repeat(9000)),8192),e=>e.status===413);
await assert.rejects(()=>readBytes(request('oversized',{'content-length':'1'}),4),e=>e.status===413);
await assert.rejects(()=>readBytes(request('abc',{'content-length':'2'}),10),e=>e.status===400);
await assert.rejects(()=>readBytes(request('abc',{'content-length':'-1'}),10),e=>e.status===400);
await assert.rejects(()=>readJson(request('null')),e=>e.status===400);
await assert.rejects(()=>readJson(request('[]')),e=>e.status===400);
await assert.rejects(()=>readJson(request(new Uint8Array([0xff]))),e=>e.status===400);
assert.deepEqual(await readJson(request('{"action":"test"}')),{action:'test'});
let cancelled=false;
const stream=new ReadableStream({pull(c){c.enqueue(new Uint8Array(5));},cancel(){cancelled=true;}});
await assert.rejects(()=>readBytes(request(stream),4),e=>e.status===413);assert.equal(cancelled,true);
console.log('PASS: bounded bytes with absent/false/invalid Content-Length, UTF-8/JSON shape and stream cancellation.');

await assert.rejects(()=>readBytes(new Request('https://test.invalid',{method:'POST',headers:{'content-length':'5'}}),10),e=>e.status===400);
