import {getCourseEntitlement,type CourseRecord} from './courses-logic';

export type CourseModule={id:string;title:string;lessons:CourseRecord[]};
export type CourseDetailsState={active:boolean;expired:boolean;pending:boolean;expires:number|null;price:number;free:boolean};

/** Course outline uses only published lessons already authorized/redacted by the existing server. */
export function courseOutline(courseId:unknown,lessons:CourseRecord[]):CourseModule[]{
 const own=lessons.filter(l=>String(l.courseId)===String(courseId)&&l.status==='published');
 const sorted=[...own].sort((a,b)=>(Number(a.order)||0)-(Number(b.order)||0)||String(a.title||'').localeCompare(String(b.title||''),'ar'));
 const modules:CourseModule[]=[];
 for(const lesson of sorted){
  const title=String(lesson.module||'').trim()||'محاضرات الكورس';
  let entry=modules.find(m=>m.title===title);
  if(!entry){entry={id:'module-'+modules.length,title,lessons:[]};modules.push(entry);}
  entry.lessons.push(lesson);
 }
 return modules;
}
export function canOpenCourseLesson(lesson:CourseRecord):boolean{
 return lesson.status==='published'&&lesson.locked!==true;
}
export function courseDetailsState(course:CourseRecord,enrollments:CourseRecord[],orders:CourseRecord[],now=Date.now()):CourseDetailsState{
 const access=getCourseEntitlement(String(course.id),enrollments,now);
 const price=Math.max(0,Number(course.price)||0);
 return {active:access.active,expired:access.expired,pending:!access.active&&orders.some(o=>String(o.courseId)===String(course.id)&&o.status==='pending'),expires:access.expires,price,free:price===0};
}
