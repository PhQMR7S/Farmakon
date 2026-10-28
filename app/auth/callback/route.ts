import {authClient} from '../../../lib/supabase/server';
import {limitRequest,requestSubject} from '../../../lib/farmakon/rate-limit';
import {NextResponse} from 'next/server';
export const dynamic='force-dynamic';
function privateResponse(response:Response){
 response.headers.set('Cache-Control','private, no-store');
 response.headers.set('Referrer-Policy','no-referrer');
 return response;
}
export async function GET(req:Request){
 const url=new URL(req.url);
 const redirect=(path:string)=>privateResponse(NextResponse.redirect(new URL(path,url.origin)));
 const refused=()=>redirect('/login?auth_error=callback');
 const codes=url.searchParams.getAll('code'),code=codes[0];
 // The provider validates the grant, signature, PKCE verifier and one-time use.
 // Do not exchange ambiguous/malformed inputs or reflect provider error details.
 if(codes.length!==1||!code||code.length>2048||/[\u0000-\u0020\u007f]/.test(code)||url.searchParams.has('error'))return refused();
 try{
  const limited=await limitRequest('auth-callback',requestSubject(req),30,900000);
  if(limited)return privateResponse(limited);
  const c=await authClient();
  const {error}=await c.auth.exchangeCodeForSession(code);
  if(error)return refused();
  // A fixed allowlist, never an arbitrary URL or a forwarded-origin header.
  return redirect(url.searchParams.get('next')==='/reset-password'?'/reset-password':'/');
 }catch{return refused();}
}
