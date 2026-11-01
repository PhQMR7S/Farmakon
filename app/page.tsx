import {redirect} from 'next/navigation';
import {authClient} from '../lib/supabase/server';

export const dynamic='force-dynamic';
export const metadata={title:'Farmakon | تأكيد التحقق — بيئة الاختبار',robots:{index:false,follow:false}};

export default async function StagingVerificationSuccess(){
 const supabase=await authClient();
 const {data:{user},error}=await supabase.auth.getUser();
 if(error||!user)redirect('/login');
 return (
  <main dir="rtl" style={{minHeight:'100dvh',display:'grid',placeItems:'center',background:'linear-gradient(145deg,#060A22,#0D1336 70%,#241627)',color:'#EEF2FF',fontFamily:'Tahoma,Arial,sans-serif',padding:24}}>
   <section style={{width:'min(100%,440px)',border:'1px solid #27375A',borderRadius:22,padding:'34px 28px',background:'#101735',boxShadow:'0 18px 70px #0005',textAlign:'center'}}>
    <div style={{display:'inline-grid',placeItems:'center',width:70,height:70,borderRadius:20,background:'#183755',fontSize:32,marginBottom:22,color:'#3FBAFD'}}>✓</div>
    <h1 style={{fontSize:25,margin:'0 0 14px'}}>تم تأكيد بريدك بنجاح!</h1>
    <p style={{fontSize:15,lineHeight:2,color:'#C5CEE9',margin:'0 0 20px'}}>وصل رمز Farmakon إلى بريدك وتم التحقق منه باستخدام نظام Supabase التجريبي.</p>
    <p style={{fontSize:12,lineHeight:1.9,color:'#9AA5CC',margin:'0 0 18px'}}>هذه صفحة نتيجة اختبار البريد فقط وليست لوحة الطالب. منصة Farmakon الأصلية لم تتغير، ولم تُربط بقاعدة الاختبار.</p>
    <a href="/login" style={{display:'inline-block',padding:'12px 22px',borderRadius:11,background:'#3FBAFD',color:'#060A22',fontWeight:700,textDecoration:'none'}}>العودة إلى تسجيل الدخول</a>
   </section>
  </main>
 );
}
