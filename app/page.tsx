import {redirect,notFound} from 'next/navigation';
import Farmakon from './platform';
import {authClient} from '../lib/supabase/server';

export const dynamic='force-dynamic';
export const metadata={title:'Farmakon V10.2 | مركز التعلّم — بيئة الاختبار',robots:{index:false,follow:false}};

export default async function StudentStagingHome(){
 // Critical: never render an authenticated staging workspace against production Auth.
 if(process.env.VERCEL_ENV!=='preview'||
    process.env.FARMAKON_AUTH_STAGING_ONLY!=='1'||
    process.env.NEXT_PUBLIC_SUPABASE_URL!=='https://qfzharpouemueipsrduv.supabase.co')notFound();
 const c=await authClient();
 const {data:{user},error}=await c.auth.getUser();
 if(error||!user?.email||!user.email_confirmed_at)redirect('/login');
 return <Farmakon authSessionKey={user.last_sign_in_at||''} startInLearning/>;
}
