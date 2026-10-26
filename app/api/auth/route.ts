import {limitRequest,requestSubject} from '../../../lib/farmakon/rate-limit';
import {readJson,RequestError} from '../../../lib/http';
import {authClient} from '../../../lib/supabase/server';
import {z} from 'zod';
export const dynamic='force-dynamic';
export async function POST(req:Request){if(req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'طلب غير مسموح'},{status:403,headers:{'Cache-Control':'private, no-store'}});try{const b=z.object({action:z.enum(['login','signup','forgot','reset','logout']),email:z.string().email().max(250).optional(),password:z.string().min(10).max(128).optional(),name:z.string().trim().min(2).max(100).optional()}).parse(await readJson(req,8192));if(b.action!=='logout'){const limited=await limitRequest('auth',requestSubject(req),30,900000);if(limited)return limited;}const c=await authClient(),origin=new URL(req.url).origin;let error;
if(b.action==='login'){if(!b.email||!b.password)throw Error();({error}=await c.auth.signInWithPassword({email:b.email,password:b.password}));}
if(b.action==='signup'){if(!b.email||!b.password||!b.name)throw Error();({error}=await c.auth.signUp({email:b.email,password:b.password,options:{data:{name:b.name},emailRedirectTo:origin+'/auth/callback'}}));}
if(b.action==='forgot'){if(!b.email)throw Error();await c.auth.resetPasswordForEmail(b.email,{redirectTo:origin+'/auth/callback?next=/reset-password'});return Response.json({message:'إذا كان البريد مسجلاً ستصلك تعليمات الاستعادة.'},{headers:{'Cache-Control':'private, no-store'}});}
if(b.action==='reset'){if(!b.password||!(await c.auth.getUser()).data.user)throw Error();({error}=await c.auth.updateUser({password:b.password}));}
if(b.action==='logout')({error}=await c.auth.signOut({scope:'local'}));
return Response.json(error?{error:'تعذر إتمام الطلب. تحقق من البيانات وتأكيد بريدك.'}:{ok:true,message:b.action==='signup'?'راجع بريدك لتأكيد الحساب.':'تمت العملية بنجاح'},{status:error?400:200,headers:{'Cache-Control':'private, no-store'}});
}catch(e){if(e instanceof Error&&e.message.startsWith('RATE_LIMIT_'))return Response.json({error:'الخدمة غير متاحة مؤقتاً'},{status:503,headers:{'Cache-Control':'private, no-store'}});if(e instanceof RequestError)return Response.json({error:e.message},{status:e.status,headers:{'Cache-Control':'private, no-store'}});return Response.json({error:'تحقق من البيانات. كلمة المرور 10 أحرف على الأقل.'},{status:400,headers:{'Cache-Control':'private, no-store'}});}}
