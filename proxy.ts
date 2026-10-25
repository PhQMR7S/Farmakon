import {createServerClient} from '@supabase/ssr';
import {NextResponse,type NextRequest} from 'next/server';
export async function proxy(request:NextRequest){let response=NextResponse.next({request});if(!process.env.NEXT_PUBLIC_SUPABASE_URL)return response;const c=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{cookies:{getAll:()=>request.cookies.getAll(),setAll(items){items.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});items.forEach(({name,value,options})=>response.cookies.set(name,value,options));}}});await c.auth.getUser();response.headers.set('Cache-Control','private, no-store');return response;}
export const config={matcher:['/','/api/:path*','/auth/:path*','/reset-password']};
