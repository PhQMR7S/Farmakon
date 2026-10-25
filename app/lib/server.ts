import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../chatgpt-auth';
export const db=()=>{if(!env.DB)throw new Error('قاعدة البيانات غير متاحة الآن');return env.DB;};
export const bucket=()=>{const b=(env as unknown as {BUCKET:R2Bucket}).BUCKET;if(!b)throw new Error('التخزين غير متاح الآن');return b;};
export const uuid=()=>crypto.randomUUID();
export async function identity(){const u=await getChatGPTUser();if(!u)throw new Error('AUTH');return {...u,email:u.email.toLowerCase()};}
export async function owner(u:{userId:string}){const s=await db().prepare("SELECT data FROM settings WHERE id='owner'").first<{data:string}>();return s?.data===u.userId;}
export async function record(id:string){const r=await db().prepare('SELECT * FROM records WHERE id=?').bind(id).first<any>();return r?{...JSON.parse(r.data),id:r.id,kind:r.kind,courseId:r.course_id,created:r.created}:null;}
export async function rows(kind:string){const {results}=await db().prepare('SELECT * FROM records WHERE kind=? ORDER BY created DESC').bind(kind).all<any>();return results.map(r=>({...JSON.parse(r.data),id:r.id,kind:r.kind,courseId:r.course_id,created:r.created}));}
export async function write(kind:string,data:any,id=uuid()){await db().prepare('INSERT INTO records(id,kind,course_id,data,created) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,course_id=excluded.course_id').bind(id,kind,data.courseId||'',JSON.stringify(data),Date.now()).run();return id;}
export async function access(email:string,courseId:string,isAdmin:boolean){if(isAdmin)return true;if(!courseId)return false;return !!await db().prepare('SELECT id FROM enrollments WHERE email=? AND course_id=? AND expires>?').bind(email,courseId,Date.now()).first();}
export async function canRead(r:any,email:string,admin:boolean){if(admin)return true;if(!r||r.status==='draft')return false;const c=r.kind==='course'?r:await record(r.courseId);if(!c||c.status!=='published')return false;return !!r.free||await access(email,c.id,false);}
export async function audit(user:string,action:string,target:string){await write('audit',{user,action,target});}
export function json(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store'}});}
export async function hash(s:string){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('');}
