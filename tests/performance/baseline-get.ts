// Frozen GET from e86e67e for same-run before/after measurements. Test only.
import {limitRequest} from '../../../lib/farmakon/rate-limit';
import {readJson,RequestError} from '../../../lib/http';
import { z } from 'zod';
import {db,identity,owner,rows,record,write,access,canRead,canReadAttempt,uuid,audit,json,hash,examAnswers,examDue,publicAttempt,finishExam} from '../../lib/server';
export async function GET(){try{const u=await identity();const admin=await owner(u);return await db().transaction(async()=>{await db().prepare('INSERT INTO members(id,email,name,created) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,name=excluded.name').bind(u.userId,u.email,u.displayName,Date.now()).run();const kinds=['course','lesson','file','question','exam','announcement'];const lists:any={};await Promise.all(kinds.map(async k=>{lists[k]=await rows(k)}));
if(!admin){lists.course=lists.course.filter((r:any)=>r.status==='published');for(const k of ['lesson','file','question','exam']){const out=[];for(const r of lists[k]){if(r.status!=='published'||!lists.course.some((c:any)=>c.id===r.courseId))continue;const ok=await canRead(r,u.email,false);if(k==='question'){if(ok){const {correct,explanation,...safe}=r;out.push(safe);}}else if(k==='lesson')out.push(ok?r:{id:r.id,courseId:r.courseId,title:r.title,module:r.module,minutes:r.minutes,order:r.order,locked:true,status:r.status});else if(ok)out.push(r);}lists[k]=out;}lists.announcement=lists.announcement.filter((r:any)=>r.status==='published');}
const enr=admin?await db().prepare('SELECT * FROM enrollments').all():await db().prepare('SELECT * FROM enrollments WHERE email=?').bind(u.email).all();
const s=await db().prepare("SELECT data FROM settings WHERE id='general'").first<any>();const hasOwner=!!await db().prepare("SELECT id FROM settings WHERE id='owner'").first();
const attempts=[],completedAttempts=[];
for(const at of await rows('attempt')){
 if(at.userId!==u.userId||!await canReadAttempt(at,u.email,admin))continue;
 const now=Date.now();
 if(at.status==='active'&&examDue(at,now)){at.result=await finishExam(at,now);at.status='done';}
 if(at.status==='active')attempts.push(publicAttempt(at,now));
 else if(at.status==='done'&&completedAttempts.length<50)completedAttempts.push({id:at.id,examId:at.examId,title:at.title,result:at.result});
}
let extras:any={};if(admin){extras={members:(await db().prepare('SELECT * FROM members ORDER BY created DESC').all()).results,codes:(await db().prepare('SELECT id,suffix,course_id,days,expires,used_by FROM codes').all()).results,orders:await rows('order'),tickets:await rows('ticket'),audit:(await rows('audit')).slice(0,100)};}else{extras={orders:(await rows('order')).filter((r:any)=>r.userId===u.userId),tickets:(await rows('ticket')).filter((r:any)=>r.userId===u.userId)};}
const act=await db().prepare('SELECT * FROM activity WHERE user_id=?').bind(u.userId).all<any>();
return json({user:{name:u.displayName,email:u.email,id:u.userId,admin},needsSetup:false,serverNow:Date.now(),attempts,completedAttempts,...lists,enrollments:enr.results,activity:act.results.map(a=>({...a,data:JSON.parse(a.data)})),settings:s?JSON.parse(s.data):{name:'Farmakon',tagline:'مساحتك لتعلّم الصيدلة',paymentInstructions:'',support:'',offlineHours:48},...extras});});}catch(e){console.error(e);return json({error:e instanceof Error&&e.message==='AUTH'?'سجّل الدخول للمتابعة':'تعذّر تحميل البيانات، أعد المحاولة'},e instanceof Error&&e.message==='AUTH'?401:503);}}
