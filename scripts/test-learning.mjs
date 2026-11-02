import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import ts from 'typescript';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=await readFile(path.join(root,'app/components/learning-logic.ts'),'utf8');
const transpiled=ts.transpileModule(source,{
 compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},
 reportDiagnostics:true
});
if(transpiled.diagnostics?.some(x=>x.category===ts.DiagnosticCategory.Error))throw Error('TypeScript transform failed');
const mod=await import('data:text/javascript;base64,'+Buffer.from(transpiled.outputText).toString('base64'));
const {chooseGreeting,greetingForHour,formatResumeTime,getResumeSeconds,safeLastTimestamp}=mod;
let checks=0;
function verify(desc,fn){fn();checks++;console.log('PASS',desc)}
verify('first welcome can be any of the five variants',()=>{
 const results=new Set(Array.from({length:5},(_,n)=>chooseGreeting(-1,5,n/5+.001)));
 assert.equal(results.size,5);
});
verify('new sign-in always chooses a different message when multiple exist',()=>{
 for(let old=0;old<5;old++)for(let i=0;i<100;i++)assert.notEqual(chooseGreeting(old,5,i/100),old);
});
verify('missing, malformed and boundary seeds stay valid',()=>{
 for(const seed of [NaN,Infinity,-100,0,.5,1,99])assert.ok(chooseGreeting(-1,5,seed)>=0&&chooseGreeting(-1,5,seed)<5);
 assert.equal(chooseGreeting(0,1,.8),0);
});
verify('greeting bands cover all local hours exactly',()=>{
 for(let hour=0;hour<24;hour++){
  const got=greetingForHour(hour);
  assert.equal(got,hour>=5&&hour<12?'صباح الخير':hour>=12&&hour<17?'نهارك سعيد':hour>=17&&hour<23?'مساء الخير':'أهلاً بك');
 }
 assert.equal(greetingForHour(-1),'أهلاً بك');
});
verify('resume positions clamp negative, bogus and past-end values',()=>{
 assert.equal(getResumeSeconds(-4,20),0);
 assert.equal(getResumeSeconds('nonsense',20),0);
 assert.equal(getResumeSeconds(450,20),450);
 assert.equal(getResumeSeconds(50000,20),1200);
 assert.equal(getResumeSeconds(Infinity,20),0);
});
verify('resume time formats without claiming total watch duration',()=>{
 assert.equal(formatResumeTime(90),'1 دقيقة');
 assert.equal(formatResumeTime(4500),'1 س و15 د');
 assert.equal(formatResumeTime(-30),'0 دقيقة');
});
verify('recent activity ordering handles empty and invalid timestamps',()=>{
 assert.equal(safeLastTimestamp({updated:1760000000000}),1760000000000);
 assert.equal(safeLastTimestamp({created:1760000000001}),1760000000001);
 assert.equal(safeLastTimestamp({updated:'not-a-date'}),0);
});
console.log(`PASS ${checks} Learning Center logic groups`);
