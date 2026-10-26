import {db,identity} from '../../../lib/server';
import {readJson,RequestError} from '../../../../lib/http';
import {limitRequest} from '../../../../lib/farmakon/rate-limit';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const fail=(error:string,status:number)=>Response.json({error},{status,headers});
const maxBytes=5*1024*1024;
type Row={id:string,kind:string,data:string,created:number};
function pick(data:Record<string,unknown>,keys:string[]){return Object.fromEntries(keys.filter(k=>['string','number','boolean'].includes(typeof data[k])||data[k]===null).map(k=>[k,data[k]]));}
function answers(value:unknown){return value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).filter(([k,v])=>k.length<=100&&Number.isInteger(v)&&Number(v)>=0&&Number(v)<=3)):{};}

// Export the authenticated user's study data only. Never accept a target user ID.
export async function POST(req:Request){
 if(req.headers.get('origin')!==new URL(req.url).origin)return fail('طلب غير مسموح',403);
 try{
  const u=await identity();
  const body=await readJson(req,1024);if(Object.keys(body).length)return fail('طلب غير صالح',400);
  const limited=await limitRequest('study-export',u.userId,5,15*60000);if(limited)return limited;
  return await db().transaction(async()=>{
   const recordWhere="kind IN ('attempt','order','ticket') AND json_extract(data,'$.userId')=?";
   // Conservative UTF-8 upper bound checked in SQL before loading JSON snapshots.
   const summaries=await Promise.all([
    db().prepare(`SELECT COUNT(*) AS n,COALESCE(SUM(length(data)*4),0) AS bytes FROM records WHERE ${recordWhere}`).bind(u.userId).first<{n:number,bytes:number}>(),
    db().prepare('SELECT COUNT(*) AS n,COALESCE(SUM(length(data)*4),0) AS bytes FROM activity WHERE user_id=?').bind(u.userId).first<{n:number,bytes:number}>(),
    db().prepare('SELECT COUNT(*) AS n FROM enrollments WHERE email=?').bind(u.email).first<{n:number}>()
   ]);
   if(summaries.some(s=>!s||s.n>1000)||(summaries[0]?.bytes||0)+(summaries[1]?.bytes||0)>maxBytes)return fail('حجم بياناتك يتجاوز التنزيل المباشر. تواصل مع الدعم للحصول على نسخة كاملة.',413);
   const records=(await db().prepare(`SELECT id,kind,data,created FROM records WHERE ${recordWhere} ORDER BY created,id LIMIT 1001`).bind(u.userId).all<Row>()).results;
   const activity=(await db().prepare('SELECT id,kind,target,data,updated FROM activity WHERE user_id=? ORDER BY updated,id LIMIT 1001').bind(u.userId).all<{id:string,kind:string,target:string,data:string,updated:number}>()).results;
   const enrollments=(await db().prepare('SELECT id,course_id,expires,source FROM enrollments WHERE email=? ORDER BY id LIMIT 1001').bind(u.email).all()).results;
   if(records.length>1000||activity.length>1000||enrollments.length>1000)return fail('حجم البيانات كبير. تواصل مع الدعم.',413);
   const attempts=[],orders=[],tickets=[];
   for(const r of records){const d=JSON.parse(r.data);if(d.userId!==u.userId)throw Error('EXPORT_SCOPE');
    const meta={id:r.id,created:r.created};
    if(r.kind==='attempt')attempts.push({...meta,...pick(d,['examId','courseId','status','deadline']),answers:answers(d.answers),...(d.status==='done'&&d.result?{result:pick(d.result,['score','total','late'])}:{})});
    if(r.kind==='order')orders.push({...meta,...pick(d,['courseId','reference','amount','status','reviewedAt'])});
    if(r.kind==='ticket')tickets.push({...meta,...pick(d,['title','description','status','reply'])});
   }
   const result={format:'farmakon-study-data',version:1,exportedAt:new Date().toISOString(),profile:{name:typeof u.displayName==='string'?u.displayName:'',email:u.email},enrollments,activity:activity.filter(a=>['progress','exam'].includes(a.kind)).map(a=>({id:a.id,kind:a.kind,target:a.target,updated:a.updated,data:pick(JSON.parse(a.data),a.kind==='progress'?['seconds','completed','note']:['score','total','title'])})),attempts,orders,tickets};
   const json=JSON.stringify(result,null,2);if(Buffer.byteLength(json,'utf8')>maxBytes)return fail('حجم البيانات كبير. تواصل مع الدعم.',413);
   return new Response(json,{headers:{...headers,'Content-Type':'application/json; charset=utf-8','Content-Disposition':'attachment; filename="farmakon-study-data.json"'}});
  });
 }catch(e){if(e instanceof RequestError)return fail(e.message,e.status);return fail(e instanceof Error&&e.message==='AUTH'?'سجّل الدخول للمتابعة':'تعذر تجهيز النسخة. أعد المحاولة.',e instanceof Error&&e.message==='AUTH'?401:503);}
}
