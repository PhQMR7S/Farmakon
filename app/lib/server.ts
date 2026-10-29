import {database} from '../../lib/database';
import {storage} from '../../lib/storage';
import {authClient} from '../../lib/supabase/server';
import {deletionEnabled} from '../../lib/farmakon/privacy/gate';
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
 if(deletionEnabled()){
  let deleting;try{deleting=await db().prepare('SELECT user_id FROM farmakon.deletion_jobs WHERE user_id=?').bind(user.id).first();}catch{throw Error('SESSION_CHECK_UNAVAILABLE');}
  if(deleting)throw Error('AUTH');
 }
 return {userId:user.id,email:user.email.toLowerCase(),displayName:user.user_metadata?.name||user.email};
}
export async function owner(u:{userId:string,email?:string}){return !!process.env.FARMAKON_OWNER_EMAIL&&u.email===process.env.FARMAKON_OWNER_EMAIL.toLowerCase();}
export async function record(id:string){const r=await db().prepare('SELECT * FROM records WHERE id=?').bind(id).first<any>();return r?{...JSON.parse(r.data),id:r.id,kind:r.kind,courseId:r.course_id,created:r.created}:null;}
export async function rows(kind:string){const {results}=await db().prepare('SELECT * FROM records WHERE kind=? ORDER BY created DESC').bind(kind).all<any>();return results.map(r=>({...JSON.parse(r.data),id:r.id,kind:r.kind,courseId:r.course_id,created:r.created}));}
// Request-scoped database filtering; never a cross-user/shared cache.
export async function userRows(kind:string,userId:string,status?:string,limit?:number){
 if(kind==='attempt'&&examStoreEnabled())return examRows(userId,status,limit);
 const clause=status?" AND json_extract(data,'$.status')=?":'';
 const cap=limit?' LIMIT ?':'';
 const args:unknown[]=[kind,userId];if(status)args.push(status);if(limit)args.push(limit);
 const {results}=await db().prepare("SELECT * FROM records WHERE kind=? AND json_extract(data,'$.userId')=?"+clause+' ORDER BY created DESC,id DESC'+cap).bind(...args).all<any>();
 return results.map(r=>({...JSON.parse(r.data),id:r.id,kind:r.kind,courseId:r.course_id,created:r.created}));
}
export async function assetReferences(assetId:string){
 const {results}=await db().prepare("SELECT * FROM records WHERE kind IN ('lesson','file') AND json_extract(data,'$.assetId')=?").bind(assetId).all<any>();
 return results.map(r=>({...JSON.parse(r.data),id:r.id,kind:r.kind,courseId:r.course_id,created:r.created}));
}
export async function publishedRows(kind:string){
 const {results}=await db().prepare("SELECT * FROM records WHERE kind=? AND json_extract(data,'$.status')='published' ORDER BY created DESC,id DESC").bind(kind).all<any>();
 return results.map(r=>({...JSON.parse(r.data),id:r.id,kind:r.kind,courseId:r.course_id,created:r.created}));
}
// Only fixed operation names enter technical logs; never serialize provider/SQL
// exceptions, which can embed account values, cookies or signed URLs.
export function reportFailure(operation:string){console.error(JSON.stringify({event:'farmakon_api_failure',operation}));}
export async function write(kind:string,data:any,id=uuid()){
 if(kind==='attempt'&&examStoreEnabled()){
  await examStoreReady();
  await db().prepare('INSERT INTO farmakon.exam_attempts(user_id,id,kind,course_id,data,created) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,id) DO UPDATE SET data=excluded.data,course_id=excluded.course_id').bind(data.userId,id,kind,data.courseId||'',JSON.stringify(data),Date.now()).run();return id;
 }
await db().prepare('INSERT INTO records(id,kind,course_id,data,created) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,course_id=excluded.course_id').bind(id,kind,data.courseId||'',JSON.stringify(data),Date.now()).run();return id;}
export async function access(email:string,courseId:string,isAdmin:boolean){if(isAdmin)return true;if(!courseId)return false;return !!await db().prepare('SELECT id FROM enrollments WHERE email=? AND course_id=? AND expires>?').bind(email,courseId,Date.now()).first();}
// Caller owns a SERIALIZABLE transaction. Zero is the existing explicit revoke
// sentinel; only an owner-initiated manual enrollment may restore that right.
export async function extendEnrollment(email:string,courseId:string,days:number,source:'manual'|'code',now=Date.now()){
 const duration=days*86400000;
 const guard=source==='code'?' WHERE enrollments.expires<>0':'';
 const result=await db().prepare('INSERT INTO enrollments(id,email,course_id,expires,source) VALUES(?,?,?,?,?) ON CONFLICT(email,course_id) DO UPDATE SET expires=MAX(enrollments.expires,?)+?,source=excluded.source'+guard).bind(uuid(),email,courseId,now+duration,source,now,duration).run();
 if(!result.meta.changes)throw Error('ENROLLMENT_REVOKED');
}
export async function canRead(r:any,email:string,admin:boolean){if(admin)return true;if(!r||r.status!=='published')return false;const c=r.kind==='course'?r:await record(r.courseId);if(!c||c.kind!=='course'||c.status!=='published')return false;return !!r.free||await access(email,c.id,false);}
export async function audit(user:string,action:string,target:string){await write('audit',{user,action,target});}
export function json(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store'}});}
export async function hash(s:string){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('');}

// Attempt snapshots contain protected course content; recheck live authorization on every use.
export async function canReadAttempt(at:any,email:string,admin:boolean){const ex=await record(at.examId);return !!ex&&ex.kind==='exam'&&ex.courseId===at.courseId&&await canRead(ex,email,admin);}

// v2 freezes answer input at deadline. The historical 15s transport grace is
// retained for legacy attempts only; never reinterpret already awarded results.
export const examGraceMs=15000;
export function examAnswers(at:any,input:Record<string,number>){
 const keys=new Set(at.questions.map((q:any)=>q.id));
 if(Object.keys(input).some(k=>!keys.has(k)))throw Error('EXAM_ANSWERS');
 return {...(at.answers||{}),...input};
}
export function examDue(at:any,now:number){return at.timingVersion===2?now>=at.deadline:now>at.deadline+examGraceMs;}
export function publicAttempt(at:any,now=Date.now()){
 const {questions,result,...safe}=at;
 return {...safe,serverNow:now,questions:questions.map(({correct,explanation,...q}:any)=>q),...(at.status==='done'?{result}:{} )};
}
// Must run within the existing SERIALIZABLE transaction. Concurrent save/submit
// or lazy settlement conflicts are rolled back and retried by the DB adapter.
export async function finishExam(at:any,now:number,answers=at.answers||{}){
 if(at.status==='done')return at.result;
 const result={score:at.questions.filter((q:any)=>answers[q.id]===q.correct).length,total:at.questions.length,late:now>at.deadline+examGraceMs,expired:now>=at.deadline,questions:at.questions.map((q:any)=>({...q,selected:answers[q.id]??null}))};
 await write('attempt',{...at,answers,status:'done',settledAt:now,result},at.id);
 await writeExamEvent(at, result, now);
 return result;
}

/** Disabled by default. Prepared schema is never installed automatically. */
export function examStoreEnabled(){
 const enabled=process.env.FARMAKON_EXAM_STORE_ENABLED==='true';
 if(enabled&&process.env.VERCEL_ENV==='production')throw Error('EXAM_STORE_RELEASE_NOT_APPROVED');
 return enabled;
}
export async function examStoreReady(){
 const r=await db().prepare("SELECT ready FROM farmakon.exam_store_control WHERE id='exam-v1'").first<{ready:boolean}>();
 if(r?.ready!==true)throw Error('EXAM_STORE_NOT_READY');
}
export async function examRows(userId:string,status?:string,limit?:number){
 await examStoreReady();
 const args:unknown[]=[userId];if(status)args.push(status);if(limit)args.push(limit);
 const r=await db().prepare("SELECT id,kind,course_id,data,created FROM farmakon.exam_attempts WHERE user_id=?"+(status?" AND data::jsonb->>'status'=?":'')+' ORDER BY created DESC,id DESC'+(limit?' LIMIT ?':'')).bind(...args).all<any>();
 return r.results.map(r=>({...JSON.parse(r.data),id:r.id,kind:r.kind,courseId:r.course_id,created:r.created}));
}
export async function attemptRecord(id:string,userId:string){
 if(!examStoreEnabled())return record(id);
 await examStoreReady();
 const r=await db().prepare('SELECT id,kind,course_id,data,created FROM farmakon.exam_attempts WHERE user_id=? AND id=?').bind(userId,id).first<any>();
 return r?{...JSON.parse(r.data),id:r.id,kind:r.kind,courseId:r.course_id,created:r.created}:null;
}
export async function writeExamEvent(at:any,result:any,now:number){
 const table=examStoreEnabled()?'farmakon.exam_results':'activity';
 if(examStoreEnabled())await examStoreReady();
 await db().prepare('INSERT INTO '+table+'(id,user_id,kind,target,data,updated) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,kind,target) DO NOTHING').bind(uuid(),at.userId,'exam',at.id,JSON.stringify({score:result.score,total:result.total,title:at.title||(await record(at.examId))?.title}),now).run();
}
export async function studyActivity(userId:string){
 if(!examStoreEnabled())return (await db().prepare('SELECT * FROM activity WHERE user_id=?').bind(userId).all<any>()).results;
 await examStoreReady();
 return (await db().prepare("SELECT id,user_id,kind,target,data,updated FROM activity WHERE user_id=? AND kind<>'exam' UNION ALL SELECT id,user_id,kind,target,data,updated FROM farmakon.exam_results WHERE user_id=?").bind(userId,userId).all<any>()).results;
}
