import {createHmac} from 'node:crypto';
import {isIP} from 'node:net';
import {database} from '../database';

// Deployment gate: migration + secret must be reviewed before enabling this server-only flag.
export async function consumeLimit(scope:string,subject:string,limit:number,windowMs:number,now=Date.now()){
 const secret=process.env.FARMAKON_RATE_LIMIT_SECRET;
 if(!secret||secret.length<32)throw new Error('RATE_LIMIT_NOT_CONFIGURED');
 const key=createHmac('sha256',secret).update(scope+'\0'+subject).digest('hex');
 const row=await database.prepare(`INSERT INTO farmakon.rate_limits(key,count,reset_at) VALUES(?,1,?)
 ON CONFLICT(key) DO UPDATE SET count=CASE WHEN farmakon.rate_limits.reset_at<=? THEN 1 ELSE farmakon.rate_limits.count+1 END,
 reset_at=CASE WHEN farmakon.rate_limits.reset_at<=? THEN excluded.reset_at ELSE farmakon.rate_limits.reset_at END
 RETURNING count,reset_at`).bind(key,now+windowMs,now,now).first<{count:number,reset_at:number}>();
 if(!row)throw new Error('RATE_LIMIT_UNAVAILABLE');
 // Bounded retention, no raw IP, email, prompt, or password in the table.
 await database.prepare('DELETE FROM farmakon.rate_limits WHERE reset_at<?').bind(now-86400000).run();
 return {allowed:row.count<=limit,retryAfter:Math.max(1,Math.ceil((row.reset_at-now)/1000))};
}
export function requestSubject(req:Request){
 // Trust Vercel's overwritten forwarding header only on Vercel. Else share a safe local bucket.
 const value=process.env.VERCEL==='1'?req.headers.get('x-vercel-forwarded-for')?.trim():undefined;
 return value&&isIP(value)?value:'unresolved-client';
}
export async function limitRequest(scope:string,subject:string,limit:number,windowMs:number){
 if(process.env.FARMAKON_RATE_LIMIT_ENABLED!=='true')return null;
 let result;try{result=await consumeLimit(scope,subject,limit,windowMs);}catch{throw new Error('RATE_LIMIT_UNAVAILABLE');}
 return result.allowed?null:Response.json({error:'طلبات كثيرة. انتظر قليلًا ثم أعد المحاولة.'},{status:429,headers:{'Retry-After':String(result.retryAfter),'Cache-Control':'private, no-store'}});
}
