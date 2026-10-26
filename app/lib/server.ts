import {database} from '../../lib/database';
import {storage} from '../../lib/storage';
import {authClient} from '../../lib/supabase/server';
export const db=()=>database;
export const bucket=()=>storage;
export const uuid=()=>crypto.randomUUID();
export async function identity(){
 const c=await authClient(),strict=process.env.FARMAKON_STRICT_SESSIONS_ENABLED==='true';
 let token:string|undefined;
 if(strict){const {data,error}=await c.auth.getSession();if(error||!data.session?.access_token)throw new Error('AUTH');token=data.session.access_token;}
 // Verify this exact token with Auth before inspecting its session claim. Never
 // authorize from getSession().user or from an unverified decoded JWT.
 const {data:{user},error}=await c.auth.getUser(token);
 if(error||!user?.email||!user.email_confirmed_at)throw new Error('AUTH');
 if(strict){
  let claims;try{claims=JSON.parse(Buffer.from(token!.split('.')[1],'base64url').toString('utf8'));}catch{throw new Error('AUTH');}
  if(claims.sub!==user.id||typeof claims.session_id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(claims.session_id))throw new Error('AUTH');
  let session;try{session=await db().prepare('SELECT farmakon.session_is_active(?,?) AS active').bind(claims.session_id,user.id).first<{active:boolean}>();}catch{throw new Error('SESSION_CHECK_UNAVAILABLE');}
  if(session?.active!==true)throw new Error('AUTH');
 }
 return {userId:user.id,email:user.email.toLowerCase(),displayName:user.user_metadata?.name||user.email};
}
export async function owner(u:{userId:string,email?:string}){return !!process.env.FARMAKON_OWNER_EMAIL&&u.email===process.env.FARMAKON_OWNER_EMAIL.toLowerCase();}
export async function record(id:string){const r=await db().prepare('SELECT * FROM records WHERE id=?').bind(id).first<any>();return r?{...JSON.parse(r.data),id:r.id,kind:r.kind,courseId:r.course_id,created:r.created}:null;}
export async function rows(kind:string){const {results}=await db().prepare('SELECT * FROM records WHERE kind=? ORDER BY created DESC').bind(kind).all<any>();return results.map(r=>({...JSON.parse(r.data),id:r.id,kind:r.kind,courseId:r.course_id,created:r.created}));}
export async function write(kind:string,data:any,id=uuid()){await db().prepare('INSERT INTO records(id,kind,course_id,data,created) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,course_id=excluded.course_id').bind(id,kind,data.courseId||'',JSON.stringify(data),Date.now()).run();return id;}
export async function access(email:string,courseId:string,isAdmin:boolean){if(isAdmin)return true;if(!courseId)return false;return !!await db().prepare('SELECT id FROM enrollments WHERE email=? AND course_id=? AND expires>?').bind(email,courseId,Date.now()).first();}
export async function canRead(r:any,email:string,admin:boolean){if(admin)return true;if(!r||r.status!=='published')return false;const c=r.kind==='course'?r:await record(r.courseId);if(!c||c.kind!=='course'||c.status!=='published')return false;return !!r.free||await access(email,c.id,false);}
export async function audit(user:string,action:string,target:string){await write('audit',{user,action,target});}
export function json(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store'}});}
export async function hash(s:string){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('');}

// Attempt snapshots contain protected course content; recheck live authorization on every use.
export async function canReadAttempt(at:any,email:string,admin:boolean){const ex=await record(at.examId);return !!ex&&ex.kind==='exam'&&ex.courseId===at.courseId&&await canRead(ex,email,admin);}
