import {identity,owner,db} from '../../../lib/server';
import {authClient} from '../../../../lib/supabase/server';
import {deletionEnabled,assertDisposable} from '../../../../lib/farmakon/privacy/gate';
import {limitRequest} from '../../../../lib/farmakon/rate-limit';
import {readJson,RequestError} from '../../../../lib/http';
import {verifyDeletionPassword} from '../../../../lib/farmakon/privacy/reauth';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'};
const reply=(body:unknown,status:number)=>Response.json(body,{status,headers});
export async function POST(req:Request){
 try{
  if(!deletionEnabled())return reply({error:'غير متاح'},404);
  if(req.headers.get('origin')!==new URL(req.url).origin)return reply({error:'طلب غير مسموح'},403);
  const u=await identity();if(await owner(u))return reply({error:'لا يمكن حذف حساب المالك من هذا المسار'},403);
  const limited=await limitRequest('synthetic-account-delete',u.userId,3,900000);if(limited)return limited;
  const b=await readJson(req,2048);
  if(Object.keys(b).some(k=>!['confirmation','password'].includes(k))||b.confirmation!=='DELETE SYNTHETIC ACCOUNT'||typeof b.password!=='string'||b.password.length<1||b.password.length>128)return reply({error:'تأكيد الحذف الاصطناعي مطلوب'},400);
  const c=await authClient();const {data,error}=await c.auth.getUser();if(error||data.user?.id!==u.userId)throw Error('AUTH');
  assertDisposable(data.user,process.env.FARMAKON_OWNER_EMAIL);
  await verifyDeletionPassword(u.userId,u.email,b.password);
  await db().transaction(async()=>{await db().prepare("INSERT INTO farmakon.deletion_jobs(user_id,email,policy,created,updated) VALUES(?,?,'synthetic-v1',?,?) ON CONFLICT(user_id) DO NOTHING").bind(u.userId,u.email,Date.now(),Date.now()).run();});
  return reply({accepted:true,message:'تم قبول طلب الاختبار وحجب الوصول. التنفيذ النهائي يتطلب العامل المعزول.'},202);
 }catch(e){if(e instanceof RequestError)return reply({error:e.message},e.status);const auth=e instanceof Error&&e.message==='AUTH';return reply({error:auth?'سجّل الدخول للمتابعة':'تعذر قبول الطلب'},auth?401:503);}
}
