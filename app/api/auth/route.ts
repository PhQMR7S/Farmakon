import {authClient} from '../../../lib/supabase/server';
import {z} from 'zod';
export const dynamic='force-dynamic';
export async function POST(req:Request){if(req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'طلب غير مسموح'},{status:403});try{const b=z.object({action:z.enum(['login','signup','forgot','reset','logout','verifySignup','resendSignup','verifyRecovery']),email:z.string().email().max(250).optional(),password:z.string().min(10).max(128).optional(),name:z.string().trim().min(2).max(100).optional(),stage:z.enum(['1','2','3','4','5','grad']).optional(),university:z.string().trim().min(1).max(120).optional(),governorate:z.string().trim().min(1).max(120).optional(),token:z.string().regex(/^\d{6}$/).optional()}).parse(await req.json());const c=await authClient(),origin=new URL(req.url).origin;let error;
if(b.action==='login'){if(!b.email||!b.password)throw Error();({error}=await c.auth.signInWithPassword({email:b.email,password:b.password}));}
if(b.action==='signup'){
 if(!b.email||!b.password||!b.name)throw Error();
 const result=await c.auth.signUp({email:b.email,password:b.password,options:{data:{name:b.name,stage:b.stage??null,university:b.university??null,governorate:b.governorate??null},emailRedirectTo:origin+'/auth/callback'}});
 error=result.error;
 // Auth hides confirmed existing users behind a fake user with no identities.
 // Do not create a false "code was sent" state if Auth explicitly reports this case.
 // An unconfirmed account may still receive its confirmation and is handled normally.
 if(!error&&result.data.user&&Array.isArray(result.data.user.identities)&&result.data.user.identities.length===0)
  return Response.json({error:'هذا البريد مسجل سابقاً. سجّل الدخول أو استخدم نسيت كلمة المرور.',code:'EMAIL_ALREADY_REGISTERED'},{status:409,headers:{'Cache-Control':'no-store'}});
 if(error&&(error.code==='user_already_exists'||/already registered/i.test(error.message)))
  return Response.json({error:'هذا البريد مسجل سابقاً. سجّل الدخول أو استخدم نسيت كلمة المرور.',code:'EMAIL_ALREADY_REGISTERED'},{status:409,headers:{'Cache-Control':'no-store'}});
}
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
if(b.action==='forgot'){
 if(!b.email)throw Error();
 const {error:recoveryRequestError}=await c.auth.resetPasswordForEmail(b.email,{redirectTo:origin+'/auth/callback?next=/reset-password'});
 if(recoveryRequestError?.status===429)
  return Response.json({error:'عدد طلبات الإرسال كبير. انتظر قليلاً قبل المحاولة.',code:'RATE_LIMIT'},{status:429,headers:{'Cache-Control':'no-store'}});
 // A missing user is intentionally indistinguishable from a successful request.
 // A genuine SMTP/backend error should not send the user to a code screen.
 if(recoveryRequestError&&recoveryRequestError.code!=='user_not_found')
  return Response.json({error:'تعذر إرسال رمز الاستعادة حالياً. حاول لاحقاً.',code:'RECOVERY_SEND_UNAVAILABLE'},{status:503,headers:{'Cache-Control':'no-store'}});
 // Always give a generic response to prevent guessing which addresses are registered.
 return Response.json({ok:true,message:'إذا كان البريد مسجلاً، ستصلك رسالة الاستعادة.'},{headers:{'Cache-Control':'no-store'}});
}
if(b.action==='verifyRecovery'){
 if(!b.email||!b.token)throw Error();
 const {data,error:recoveryVerifyError}=await c.auth.verifyOtp({email:b.email,token:b.token,type:'recovery'});
 if(recoveryVerifyError||!data.session||!data.user||data.user.email?.toLowerCase()!==b.email.toLowerCase())
  return Response.json({error:'رمز استعادة كلمة المرور غير صحيح أو منتهي الصلاحية.',code:'RECOVERY_OTP_INVALID'},{status:400,headers:{'Cache-Control':'no-store'}});
 return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
}
if(b.action==='reset'){
 if(!b.password)return Response.json({error:'أدخل كلمة مرور جديدة تتكون من 10 أحرف على الأقل.'},{status:400});
 const {data:{user},error:sessionError}=await c.auth.getUser();
 if(sessionError||!user)return Response.json({error:'تحقق من رمز استعادة كلمة المرور أولاً.',code:'RECOVERY_SESSION_REQUIRED'},{status:401});
 ({error}=await c.auth.updateUser({password:b.password}));
 // Recovery should return to the sign-in screen; do not leave a live session on a shared device.
 if(!error)await c.auth.signOut({scope:'local'});
}
if(b.action==='logout')({error}=await c.auth.signOut({scope:'local'}));
return Response.json(error?{error:'تعذر إتمام الطلب. تحقق من البيانات وتأكيد بريدك.'}:{ok:true,message:b.action==='signup'?'راجع بريدك لتأكيد الحساب.':'تمت العملية بنجاح'},{status:error?400:200,headers:{'Cache-Control':'private, no-store'}});
}catch{return Response.json({error:'تحقق من البيانات. كلمة المرور 10 أحرف على الأقل.'},{status:400});}}
