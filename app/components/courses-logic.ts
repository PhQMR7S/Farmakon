/* Farmakon V10.3.1: pure logic reused by UI and regression tests */
export type CourseRecord=Record<string,any>;
export type CourseProgress={total:number;done:number;percent:number|null;lastActivity:number;nextLesson:CourseRecord|null};
export function normalizeCourseText(value:unknown):string{
 return String(value??'').normalize('NFKC').toLocaleLowerCase('ar')
 .replace(/[\u064B-\u065F\u0670\u0640]/g,'')
 .replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ؤ/g,'و').replace(/ئ/g,'ي').replace(/ة/g,'ه')
 .replace(/\s+/g,' ').trim();
}
export function courseMatches(course:CourseRecord,query:string):boolean{
 const q=normalizeCourseText(query);
 if(!q)return true;
 return normalizeCourseText([course.title,course.category,course.stage,course.description,course.instructor].filter(Boolean).join(' ')).includes(q);
}
export function getCourseEntitlement(courseId:string,enrollments:CourseRecord[],now=Date.now()):{active:boolean;expired:boolean;expires:number|null}{
 const list=enrollments.filter(e=>String(e.course_id||e.courseId||'')===String(courseId));
 const expires=list.map(e=>Number(e.expires)).filter(n=>Number.isFinite(n)&&n>0);
 const future=expires.filter(n=>n>now).sort((a,b)=>b-a);
 return {active:future.length>0,expired:future.length===0&&expires.some(n=>n<=now),expires:future[0]??null};
}
export function getCourseProgress(courseId:string,lessons:CourseRecord[],activity:CourseRecord[]):CourseProgress{
 const own=lessons.filter(l=>String(l.courseId)===String(courseId)&&l.status==='published'&&!l.locked).sort((a,b)=>(Number(a.order)||0)-(Number(b.order)||0));
 const lessonIds=new Set(own.map(l=>String(l.id)));
 const doneIds=new Set(activity.filter(p=>p.kind==='progress'&&lessonIds.has(String(p.target))&&p.data?.completed===true).map(p=>String(p.target)));
 const recent=activity.filter(p=>p.kind==='progress'&&lessonIds.has(String(p.target))).sort((a,b)=>(Number(b.updated)||0)-(Number(a.updated)||0));
 const recentUnfinished=recent.find(p=>!doneIds.has(String(p.target)));
 const nextLesson=(recentUnfinished?own.find(l=>String(l.id)===String(recentUnfinished.target)):null)??own.find(l=>!doneIds.has(String(l.id)))??null;
 return {total:own.length,done:doneIds.size,percent:own.length?Math.round(doneIds.size/own.length*100):null,lastActivity:Math.max(0,...recent.map(p=>Number(p.updated)||0)),nextLesson};
}
export function durationLabel(totalMinutes:number):string{
 const minutes=Math.max(0,Math.round(Number.isFinite(totalMinutes)?totalMinutes:0));
 return minutes>=60?(Math.floor(minutes/60)+' س '+(minutes%60?minutes%60+' د':'')).trim():minutes+' دقيقة';
}
export function coursePublishedLessons(courseId:string,lessons:CourseRecord[]):CourseRecord[]{
 return lessons.filter(l=>String(l.courseId)===String(courseId)&&l.status==='published');
}
