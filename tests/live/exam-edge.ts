// Reviewed ephemeral Staging fixture controller; disabled sentinels by default.
// No arbitrary SQL, IDs, project URL, password or path accepted from callers.
import postgres from 'postgres';
import {createClient} from '@supabase/supabase-js';
const NONCE='__DEPLOYMENT_NONCE__',EXPIRES=0,RUN='__RUN__';
const REF='https://qfzharpouemueipsrduv.supabase.co',C=RUN+'-course',Q=RUN+'-q',Q2=RUN+'-q2',E=RUN+'-exam',ASSET=RUN+'-pdf';
const emails=['a','b'].map(r=>RUN+'-'+r+'@example.test');
const sql=postgres(Deno.env.get('SUPABASE_DB_URL')!,{ssl:'require',max:1});let busy=false;
Deno.serve(async req=>{
 if(req.method!=='POST'||!RUN.startsWith('f006-exam-')||Date.now()>EXPIRES||req.headers.get('x-f006-probe')!==NONCE)return new Response('closed',{status:410});
 if(busy)return new Response('busy',{status:409});busy=true;
 try{
  if(Deno.env.get('SUPABASE_URL')!==REF)throw Error('scope');
  const admin=createClient(REF,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}}),{action}=await req.json();
  const users=await sql`SELECT id,email,raw_app_meta_data FROM auth.users WHERE email IN ${sql(emails)}`;
  if(users.some(u=>u.raw_app_meta_data?.farmakon_f006_fixture!==RUN))throw Error('fixture-scope');
  const write=async(id:string,kind:string,data:unknown)=>sql`INSERT INTO farmakon.records(id,kind,course_id,data,created) VALUES(${id},${kind},${C},${JSON.stringify(data)},${Date.now()})`;
  if(action==='setup'){
   if(users.length)throw Error('already-exists');const credentials=[];
   for(const email of emails){const password=crypto.randomUUID()+crypto.randomUUID();const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{farmakon_f006_fixture:RUN},user_metadata:{name:'طالب اختبار اصطناعي'}});if(error||!data.user)throw Error('auth-setup');credentials.push({id:data.user.id,email,password});}
   await sql.begin(async tx=>{for(const u of credentials)await tx`INSERT INTO farmakon.enrollments(id,email,course_id,expires,source) VALUES(${crypto.randomUUID()},${u.email},${C},${Date.now()+86400000},'f006-synthetic')`;});
   await write(C,'course',{title:'F006 synthetic course',status:'published',price:0,days:1});
   for(const [id,correct] of [[Q,1],[Q2,2]] as const)await write(id,'question',{title:id===Q?'سؤال أول اصطناعي':'سؤال ثان اصطناعي',options:['أول','ثان','ثالث','رابع'],correct,explanation:'تفسير اصطناعي',source:'Synthetic fixture',courseId:C,status:'published',free:false});
   const upload=await admin.storage.from('farmakon').upload(ASSET,new TextEncoder().encode('%PDF-1.4 F006 synthetic fixture'),{contentType:'application/pdf',cacheControl:'0'});if(upload.error)throw Error('storage-setup');
   await write(ASSET,'asset',{title:'synthetic.pdf',courseId:C,mime:'application/pdf',size:29,owner:credentials[0].id});
   await write(RUN+'-file','file',{title:'ملف اصطناعي',courseId:C,assetId:ASSET,status:'published',free:false,download:true,url:'/api/media?id='+ASSET});
   await write(E,'exam',{title:'اختبار F006 اصطناعي',courseId:C,minutes:1,questionIds:[Q,Q2],status:'published',free:false});
   return Response.json({projectRef:'qfzharpouemueipsrduv',credentials,ids:{course:C,question:Q,question2:Q2,exam:E,asset:ASSET}});
  }
  if(action==='edit')await sql`UPDATE farmakon.records SET data=(data::jsonb||${JSON.stringify({correct:0,title:'Changed synthetic question'})}::jsonb)::text WHERE id=${Q}`;
  else if(action==='revoke'||action==='restore')await sql`UPDATE farmakon.enrollments SET expires=${action==='revoke'?0:Date.now()+86400000} WHERE email=${emails[0]} AND course_id=${C}`;
  else if(action==='archive'||action==='publish')await sql`UPDATE farmakon.records SET data=jsonb_set(data::jsonb,'{status}',${JSON.stringify(action==='archive'?'draft':'published')}::jsonb)::text WHERE id=${E}`;
  else if(action==='state'){
   const attempts=await sql`SELECT id,data::jsonb->>'status' AS status,data::jsonb->'answers' AS answers,data::jsonb->'result'->>'score' AS score FROM farmakon.records WHERE kind='attempt' AND course_id=${C}`;
   const events=await sql`SELECT target,count(*)::int AS n FROM farmakon.activity WHERE kind='exam' AND target IN (SELECT id FROM farmakon.records WHERE kind='attempt' AND course_id=${C}) GROUP BY target`;
   return Response.json({attempts,events});
  }else if(action==='cleanup'){
   const removed=await admin.storage.from('farmakon').remove([ASSET]);if(removed.error)throw Error('storage-cleanup');
   for(const u of users){await sql.begin(async tx=>{await tx`DELETE FROM farmakon.activity WHERE user_id=${u.id}::text`;await tx`DELETE FROM farmakon.members WHERE id=${u.id}::text`;await tx`DELETE FROM farmakon.enrollments WHERE email=${u.email} AND course_id=${C}`;});const {error}=await admin.auth.admin.deleteUser(u.id);if(error)throw Error('auth-cleanup');}
   await sql`DELETE FROM farmakon.records WHERE course_id=${C}`;
   return Response.json({cleaned:users.length});
  }else throw Error('action');
  return Response.json({ok:true});
 }catch{return Response.json({error:'fixture-operation-failed'},{status:503});}finally{busy=false;}
});
