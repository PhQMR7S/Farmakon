import {redirect} from 'next/navigation';

// Legacy email-recovery links should use the approved Farmakon password form.
// The callback exchanges the Supabase code for an SSR cookie first; the
// password-update API still requires a real authenticated user.
export default function ResetPassword(){redirect('/farmakon-auth.html#new-password');}
