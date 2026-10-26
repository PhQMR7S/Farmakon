import 'server-only';
import {assertPreviewIsolation} from '../farmakon/preview-isolation';
import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
export async function authClient(){
 assertPreviewIsolation();
 const jar=await cookies();
 return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{
 cookies:{getAll:()=>jar.getAll(),setAll(items){try{items.forEach(({name,value,options})=>jar.set(name,value,options))}catch{/* Server pages refresh through the route handler. */}}}
 });
}
