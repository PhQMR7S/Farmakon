import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import ts from 'typescript';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const transpile=async filename=>{
 const src=await readFile(path.join(root,filename),'utf8');
 const out=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
 assert.ok(!out.diagnostics?.some(d=>d.category===ts.DiagnosticCategory.Error),filename+' must compile');
 return out.outputText;
};
const helper=await transpile('app/components/courses-logic.ts');
const helperUri='data:text/javascript;base64,'+Buffer.from(helper).toString('base64');
const logic=(await transpile('app/components/course-details-logic.ts')).replace("from './courses-logic'","from '"+helperUri+"'");
const {courseOutline,canOpenCourseLesson,courseDetailsState}=await import('data:text/javascript;base64,'+Buffer.from(logic).toString('base64'));
let total=0;
function test(label,fn){fn();total++;console.log('PASS course details:',label)}
const course={id:'c1',title:'Pharmacology',price:50000,days:180,status:'published'};
const items=[
 {id:'b',courseId:'c1',title:'Second',module:'Unit 1',order:2,status:'published',minutes:25,locked:true},
 {id:'a',courseId:'c1',title:'First',module:'Unit 1',order:1,status:'published',free:true,minutes:20},
 {id:'c',courseId:'c1',title:'Next unit',module:'Unit 2',order:3,status:'published',minutes:30},
 {id:'draft',courseId:'c1',title:'Draft',module:'Unit 1',order:4,status:'draft'},
 {id:'other',courseId:'c2',title:'Other course',status:'published'}
];
test('syllabus only shows published lessons of selected course',()=>{
 const outline=courseOutline('c1',items);
 assert.deepEqual(outline.map(m=>m.title),['Unit 1','Unit 2']);
 assert.deepEqual(outline.flatMap(m=>m.lessons.map(l=>l.id)),['a','b','c']);
});
test('module order and lesson order follow owner order metadata',()=>{
 const data=courseOutline('c1',items);
 assert.equal(data[0].lessons[0].order,1);
 assert.equal(data[0].lessons[1].order,2);
});
test('server-redacted locked lesson cannot be opened by UI',()=>{
 assert.equal(canOpenCourseLesson(items[1]),false);
 assert.equal(canOpenCourseLesson(items[0]),false);
 assert.equal(canOpenCourseLesson(items[3]),false);
 assert.equal(canOpenCourseLesson(items[4]),true);
});
test('unknown course produces empty outline and no fabricated modules',()=>{
 assert.deepEqual(courseOutline('missing',items),[]);
});
test('no subscription is available, never automatically inferred from course price',()=>{
 const state=courseDetailsState({...course,price:0},[],[],1000);
 assert.equal(state.free,true);
 assert.equal(state.active,false);
 assert.equal(state.pending,false);
});
test('live enrollment and expiry are determined by backend enrollment rows',()=>{
 const state=courseDetailsState(course,[{course_id:'c1',expires:2000}],[],1000);
 assert.equal(state.active,true);
 assert.equal(state.expires,2000);
});
test('pending status reflects actual order, not another course order',()=>{
 const row={courseId:'c1',status:'pending'};
 assert.equal(courseDetailsState(course,[],[row],1000).pending,true);
 assert.equal(courseDetailsState(course,[],[{...row,courseId:'c2'}],1000).pending,false);
 assert.equal(courseDetailsState(course,[{course_id:'c1',expires:2000}],[row],1000).pending,false);
});
test('expired access does not imply active access',()=>{
 const state=courseDetailsState(course,[{course_id:'c1',expires:800}],[],1000);
 assert.equal(state.active,false);
 assert.equal(state.expired,true);
});
const details=await readFile(path.join(root,'app/components/course-details.tsx'),'utf8');
const platform=await readFile(path.join(root,'app/platform.tsx'),'utf8');
const preview=await readFile(path.join(root,'app/v10-preview/courses/courses-client.tsx'),'utf8');
test('course details gates lesson click through the server locked flag',()=>{
 assert.match(details,/if\(canOpenCourseLesson\(lesson\)\)onOpenLesson\(lesson\)/);
 assert.match(details,/!isPreview&&!state.active&&!state.pending/);
});
test('real platform connects existing order and redeem actions',()=>{
 assert.match(platform,/onRequestSubscription=\{\(\)=>setModal\(\{kind:'order'/);
 assert.match(platform,/onRedeemCode=\{\(\)=>setModal\(\{kind:'redeem'/);
});
test('preview reuses same details without purchasing',()=>{
 assert.match(preview,/import CourseDetails from/);
 assert.match(preview,/orders=\{\[\]\} isPreview/);
});
console.log('PASS '+total+' Farmakon V10.3.2 course detail groups');
