import {authClient} from '../../../lib/supabase/server';
import {z} from 'zod';
export const dynamic='force-dynamic';
export async function POST(req:Request){if(req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'طلب غير مسموح'},{status:403});try{const b=z.object({action:z.enum(['login','signup','forgot','reset','logout','verifySignup','resendSignup']),email:z.string().email().max(250).optional(),password:z.string().min(10).max(128).optional(),name:z.string().trim().min(2).max(100).optional(),stage:z.enum(['1','2','3','4','5','grad']).optional(),university:z.string().trim().min(1).max(120).optional(),governorate:z.string().trim().min(1).max(120).optional(),token:z.string().regex(/^\d{6}$/).optional()}).parse(await req.json());const c=await authClient(),origin=new URL(req.url).origin;let error;
if(b.action==='login'){if(!b.email||!b.password)throw Error();({error}=await c.auth.signInWithPassword({email:b.email,password:b.password}));}
if(b.action==='signup'){if(!b.email||!b.password||!b.name)throw Error();({error}=await c.auth.signUp({email:b.email,password:b.password,options:{data:{name:b.name,stage:b.stage??null,university:b.university??null,governorate:b.governorate??null},emailRedirectTo:origin+'/auth/callback'}}));}
if(b.action==='verifySignup'){
 if(!b.email||!b.token)throw Error();
 const {data,error:otpError}=await c.auth.verifyOtp({email:b.email,token:b.token,type:'email'});
 if(otpError||!data.session||!data.user||data.user.email?.toLowerCase()!==b.email.toLowerCase())
  return Response.json({error:'رمز التحقق غير صحيح أو انتهت صلاحيته.'},{status:400,headers:{'Cache-Control':'no-store'}});
 return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
}
if(b.action==='resendSignup'){
 if(!b.email)throw Error();
 const {error:resendError}=await c.auth.resend({type:'signup',email:b.email});
 if(resendError){
  const rateLimited=resendError.status===429;
  return Response.json({error:rateLimited?'انتظر قليلاً قبل طلب رمز جديد.':'تعذر إرسال الرمز الآن، حاول لاحقاً.'},{status:rateLimited?429:400,headers:{'Cache-Control':'no-store'}});
 }
 return Response.json({ok:true,message:'إذا كان الحساب بانتظار التأكيد، ستصلك رسالة جديدة.'},{headers:{'Cache-Control':'no-store'}});
}
if(b.action==='forgot'){if(!b.email)throw Error();await c.auth.resetPasswordForEmail(b.email,{redirectTo:origin+'/auth/callback?next=/reset-password'});return Response.json({message:'إذا كان البريد مسجلاً ستصلك تعليمات الاستعادة.'});}
if(b.action==='reset'){if(!b.password||!(await c.auth.getUser()).data.user)throw Error();({error}=await c.auth.updateUser({password:b.password}));}
if(b.action==='logout')({error}=await c.auth.signOut({scope:'local'}));
return Response.json(error?{error:'تعذر إتمام الطلب. تحقق من البيانات وتأكيد بريدك.'}:{ok:true,message:b.action==='signup'?'راجع بريدك لتأكيد الحساب.':'تمت العملية بنجاح'},{status:error?400:200,headers:{'Cache-Control':'private, no-store'}});
}catch{return Response.json({error:'تحقق من البيانات. كلمة المرور 10 أحرف على الأقل.'},{status:400});}}
