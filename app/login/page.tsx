import {redirect} from 'next/navigation';
// The approved V5 login screen uses the existing same-origin Supabase auth API.
// Farmakon's student dashboard remains unchanged at /.
export default function Login(){redirect('/farmakon-auth.html');}
