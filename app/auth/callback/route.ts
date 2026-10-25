import {authClient} from '../../../lib/supabase/server';
import {NextResponse} from 'next/server';
export async function GET(req:Request){const u=new URL(req.url),code=u.searchParams.get('code');if(code){const c=await authClient();const {error}=await c.auth.exchangeCodeForSession(code);if(!error)return NextResponse.redirect(new URL(u.searchParams.get('next')==='/reset-password'?'/reset-password':'/',u.origin));}return NextResponse.redirect(new URL('/login',u.origin));}
