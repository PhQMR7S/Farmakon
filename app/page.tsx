import Farmakon from './platform';
import {redirect} from 'next/navigation';
import {authClient} from '../lib/supabase/server';

export const dynamic='force-dynamic';
// The authenticated root route renders the ORIGINAL Farmakon student/owner platform.
// An unconfirmed or signed-out user must complete the approved login / email OTP first.
export default async function Page(){
 const c=await authClient();
 const {data:{user},error}=await c.auth.getUser();
 if(error||!user?.email||!user.email_confirmed_at)redirect('/login');
 // A verified Supabase last-sign-in marker identifies actual new logins without exposing tokens.\n return <Farmakon authSessionKey={user.last_sign_in_at||''}/>;
}
