import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import ts from 'typescript';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=await readFile(path.join(root,'app/components/courses-logic.ts'),'utf8');
const x=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
if(x.diagnostics?.some(d=>d.category===ts.DiagnosticCategory.Error))throw Error('TypeScript compile failed');
const {normalizeCourseText,matchesNormalizedQuery,courseMatches,getCourseEntitlement,getCourseProgress,durationLabel,coursePublishedLessons}=await import('data:text/javascript;base64,'+Buffer.from(x.outputText).toString('base64'));
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS courses:',name)}
const now=1760000000000;
const courses=[{id:'a',title:'علم الأدوية',stage:'المرحلة الثالثة',category:'الصيدلة'}];
const lessons=[
 {id:'1',courseId:'a',status:'published',order:1,minutes:35},
 {id:'2',courseId:'a',status:'published',order:2,minutes:45},
 {id:'3',courseId:'a',status:'draft',order:3,minutes:60},
 {id:'4',courseId:'a',status:'published',locked:true,minutes:25},
 {id:'5',courseId:'b',status:'published',order:1}
];
const activities=[
 {kind:'progress',target:'1',updated:400,data:{seconds:300,completed:true}},
 {kind:'progress',target:'1',updated:401,data:{seconds:350,completed:true}},
 {kind:'progress',target:'2',updated:500,data:{seconds:450,completed:false}},
 {kind:'progress',target:'3',updated:800,data:{completed:true}},
 {kind:'progress',target:'4',updated:1000,data:{completed:true}},
 {kind:'progress',target:'5',updated:1100,data:{completed:true}}
];
test('Arabic search normalizes hamza and diacritics',()=>{
 assert.equal(normalizeCourseText('  أَدوية  '),'ادويه');
 assert.ok(courseMatches(courses[0],'علم الادويه'));
 assert.ok(courseMatches(courses[0],'علم الأدوية'));
 assert.ok(courseMatches(courses[0],'علم الادوية'));
 assert.ok(courseMatches(courses[0],'علم الأدوية'));
 assert.ok(courseMatches(courses[0],'الثالثة'));
});
test('multi-word Arabic/English searches ignore order, hamza and diacritics',()=>{
  assert.ok(matchesNormalizedQuery('علم الأدوية للمرحلة الثالثة','ثالثه أدوية'));
  assert.ok(matchesNormalizedQuery('Clinical Pharmacy Essentials','pharmacy CLINICAL'));
  assert.ok(!matchesNormalizedQuery('Clinical Pharmacy Essentials','pharmacy microbiology'));
  assert.ok(courseMatches({title:'علم الأدوية',stage:'المرحلة الثالثة'},'الثالثة علم'));
 });
 test('search includes category, stage and description',()=>{
 assert.ok(courseMatches({title:'Therapeutics',description:'حالات سريرية',category:'العلاجيات',stage:'الخامسة'},'حالات'));
 assert.ok(!courseMatches(courses[0],'غير موجود'));
});
test('entitlements use course ID and expiry, not just enrollment presence',()=>{
 const rows=[{course_id:'a',expires:now-1},{course_id:'a',expires:now+5000},{course_id:'b',expires:now-20}];
 assert.deepEqual(getCourseEntitlement('a',rows,now),{active:true,expired:false,expires:now+5000});
 assert.deepEqual(getCourseEntitlement('b',rows,now),{active:false,expired:true,expires:null});
 assert.deepEqual(getCourseEntitlement('c',rows,now),{active:false,expired:false,expires:null});
});
test('progress excludes drafts, locked lessons and other courses',()=>{
 const p=getCourseProgress('a',lessons,activities);
 assert.equal(p.total,2);assert.equal(p.done,1);assert.equal(p.percent,50);assert.equal(p.nextLesson?.id,'2');assert.equal(p.lastActivity,500);
});
test('duplicate completed records are not double counted',()=>{
 const p=getCourseProgress('a',[lessons[0]],activities);
 assert.equal(p.done,1);assert.equal(p.total,1);assert.equal(p.percent,100);assert.equal(p.nextLesson,null);
});
test('empty lessons yield honest unknown progress and no continuation',()=>{
 const p=getCourseProgress('unknown',lessons,activities);
 assert.equal(p.total,0);assert.equal(p.percent,null);assert.equal(p.nextLesson,null);
});
test('only published courses lessons counted',()=>{
 const p=coursePublishedLessons('a',lessons);
 assert.equal(p.length,2);assert.ok(p.every(x=>x.status==='published'&&!x.locked));
});
test('published displayed lesson count and duration match accessible progress base',()=>{
  const visible=coursePublishedLessons('a',lessons);
  const progress=getCourseProgress('a',lessons,activities);
  assert.equal(visible.length,progress.total);
  assert.equal(visible.reduce((n,l)=>n+l.minutes,0),80);
 });
 test('duration units are bounded',()=>{
 assert.equal(durationLabel(37),'37 دقيقة');assert.equal(durationLabel(120),'2 س');assert.equal(durationLabel(-4),'0 دقيقة');
});

const localeSrc=await readFile(path.join(root,'app/components/courses-i18n.ts'),'utf8');
const localeJS=ts.transpileModule(localeSrc,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
assert.ok(!localeJS.diagnostics?.some(d=>d.category===ts.DiagnosticCategory.Error),'Locale TypeScript is valid');
const {courseCopy,getCoursesCopy}=await import('data:text/javascript;base64,'+Buffer.from(localeJS.outputText).toString('base64'));
test('Arabic and English share the same course UI translation keys',()=>{
 const ar=Object.keys(courseCopy.ar).sort(),en=Object.keys(courseCopy.en).sort();
 assert.deepEqual(ar,en);
 assert.equal(getCoursesCopy('ar').myCourses,'كورساتي');
 assert.equal(getCoursesCopy('en').myCourses,'My Courses');
 assert.equal(getCoursesCopy('en').filterResults,'Apply filters');
});
const hub=await readFile(path.join(root,'app/components/courses-hub.tsx'),'utf8');
test('locale prepared without exposing a language selector before Settings',()=>{
 assert.ok(hub.includes("locale='ar'"));
 assert.ok(hub.includes("dir={en?'ltr':'rtl'}"));
 assert.ok(!hub.includes('language-selector'));
});
const platformAPI=await readFile(path.join(root,'app/api/platform/route.ts'),'utf8');
test('favorite update is user-scoped and guarded by existing preview write block',()=>{
 assert.match(platformAPI,/if\(b\.action==='courseFavorite'\)/);
 assert.match(platformAPI,/await record\(cid\)/);
 assert.match(platformAPI,/u\.userId,'course_favorite',cid/);
 assert.match(platformAPI,/if\(process\.env\.FARMAKON_PREVIEW_READ_ONLY==='1'\)return json/);
});
console.log('PASS '+passed+' V10.3.1 course-logic groups');
