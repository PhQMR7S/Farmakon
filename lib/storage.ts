import 'server-only';
import {authClient} from './supabase/server';
export const storage={async put(id:string,body:ReadableStream|null,options:{httpMetadata:{contentType:string}}){const supa=await authClient();const bytes=await new Response(body).arrayBuffer();const {error}=await supa.storage.from('farmakon').upload(id,bytes,{contentType:options.httpMetadata.contentType,cacheControl:'0',upsert:false});if(error)throw error;},async get(id:string,options?:{range:Headers}){
 const supa=await authClient();const {data,error}=await supa.storage.from('farmakon').createSignedUrl(id,60);if(error)throw error;
 const range=options?.range.get('range');const r=await fetch(data.signedUrl,{headers:range?{Range:range}:{},cache:'no-store'});if(!r.ok)return null;
 const cr=r.headers.get('content-range')?.match(/bytes (\d+)-(\d+)\/(\d+)/);return {body:r.body,size:cr?Number(cr[3]):Number(r.headers.get('content-length')),range:cr?{offset:Number(cr[1]),length:Number(cr[2])-Number(cr[1])+1}:undefined};
}};
