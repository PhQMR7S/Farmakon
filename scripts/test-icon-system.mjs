import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import ts from 'typescript';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let count=0;
function check(name,fn){fn();count++;console.log('PASS icon UI:',name)}
const content=await readFile(path.join(root,'app/components/farmakon-icons.ts'),'utf8');
const file=ts.createSourceFile('farmakon-icons.ts',content,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const semantic=file.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='courseIconKind');
assert.ok(semantic,'Course semantic selector must exist');
const semanticJS=ts.transpileModule(content.slice(semantic.getStart(file),semantic.getEnd()),{
 compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},
 reportDiagnostics:true
});
assert.ok(!semanticJS.diagnostics?.some(x=>x.category===ts.DiagnosticCategory.Error));
const {courseIconKind}=await import('data:text/javascript;base64,'+Buffer.from(semanticJS.outputText).toString('base64'));

check('summer internship uses a practical training icon',()=>{
 assert.equal(courseIconKind('التدريب الصيفي','Summer Training'),'practice');
 assert.equal(courseIconKind('Practice','Training'),'practice');
});
check('pharmacology uses drug icon, not chemistry flask',()=>{
 assert.equal(courseIconKind('علم الأدوية','Pharmacology'),'pharmacology');
 assert.equal(courseIconKind('Basic','Pharmacokinetics'),'pharmacology');
});
check('clinical pharmacy uses stethoscope',()=>{
 assert.equal(courseIconKind('الصيدلة السريرية','Clinical Pharmacy Essentials'),'clinical');
});
check('microbiology uses microscope',()=>{
 assert.equal(courseIconKind('الأحياء المجهرية','Microbiology'),'microbiology');
});
check('chemistry uses flask',()=>{
 assert.equal(courseIconKind('الكيمياء الصيدلانية','Pharmaceutical Chemistry'),'chemistry');
});
check('therapeutics uses clinical therapy icon',()=>{
 assert.equal(courseIconKind('العلاجيات','Therapeutics II'),'therapeutics');
});
check('anatomy uses anatomical icon and unknown stays generic',()=>{
 assert.equal(courseIconKind('Anatomy','Human body'),'anatomy');
 assert.equal(courseIconKind('Other','New Introduction Course'),'generalCourse');
});
const shell=await readFile(path.join(root,'app/components/v10-shell.tsx'),'utf8');
const hub=await readFile(path.join(root,'app/components/courses-hub.tsx'),'utf8');
const preview=await readFile(path.join(root,'app/v10-preview/courses/courses-client.tsx'),'utf8');
const platform=await readFile(path.join(root,'app/platform.tsx'),'utf8');
const css=await readFile(path.join(root,'app/globals.css'),'utf8');
check('header controls use semantic icons consistently',()=>{
 for(const x of ['farmIcons.menu','farmIcons.search','farmIcons.notifications','farmIcons.account'])assert.ok(shell.includes(x));
});
check('bottom navigation has different icons for courses and library',()=>{
 assert.match(shell,/id:'courses',label:'كورساتي',icon:farmIcons.courses/);
 assert.match(shell,/id:'library',label:'المكتبة',icon:farmIcons.library/);
 assert.match(shell,/id:'more',label:'المزيد',icon:farmIcons.more/);
 assert.match(shell,/fk-dock-glyph/);
});
check('student app and preview share navigation icon mapping',()=>{
 assert.match(platform,/dashboard:farmIcons.home,courses:farmIcons.courses,library:farmIcons.library/);
 assert.match(preview,/label:'كورساتي',icon:farmIcons.courses/);
});
check('course covers show specific symbols while owner images take precedence',()=>{
 assert.match(hub,/courseIconKind\(c.category,c.title\)/);
 assert.match(hub,/!coverUrl&&<div className=\{'fk-courses-cover-symbol fk-course-discipline-icon/);
 assert.ok(hub.includes("coverUrl&&<img"));
});
check('favorites shortcut remains outside horizontal chip scroller',()=>{
 const part=hub.slice(hub.indexOf('className="fk-courses-filter-shortcuts"'),hub.indexOf('className="fk-courses-results-head"'));
 assert.ok(part.includes('className="fk-courses-chips"'));
 assert.ok(part.includes("className={\'fk-courses-fav-pinned"));
 assert.ok(css.includes('.fk-courses-fav-pinned'));
});
check('global search normalizes Arabic and dock never fabricates a selected tab',()=>{
  assert.match(shell,/matchesNormalizedQuery\(\[v\.title,v\.kind\]\.join\(' '\),q\)/);
  assert.match(shell,/activeIndex>=0&&<span className="fk-dock-active-indicator"/);
 });
 check('accessible labels and reduced-motion safety are present',()=>{
 assert.ok(hub.includes('aria-label={t.favorites}'));
 assert.ok(shell.includes('aria-current='));
 assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'));
 assert.ok(css.includes('.fk-dock-glyph'));
 assert.ok(css.includes('.fk-course-tone-violet'));
});
console.log('PASS '+count+' Farmakon icon/UI regression groups');
