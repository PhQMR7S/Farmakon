// F00.5 fixed-fixture coordinator. Closed sentinels until authorized packaging.
import {createClient} from '@supabase/supabase-js';
import {database,sql} from './edge-db.ts';
import {harnessEnv} from './env.ts';
import {runSyntheticDeletion} from './provider.ts';
const NONCE='__DEPLOYMENT_NONCE__',EXPIRES=0,RUN='__RUN__';
const REF='https://qfzharpouemueipsrduv.supabase.co';
const roles=['owner','ordinary','a','b'] as const;
const email=(r:string)=>`f004-delete-${RUN}-${r}@example.test`;
const key=(s:string)=>RUN+'-'+s;
const check=(value:unknown,stage:string)=>{if(!value)throw Error(stage)};
const ids={course:key('course'),lesson:key('lesson'),question:key('question'),exam:key('exam'),assetA:key('a.pdf'),assetB:key('b.pdf'),fileA:key('file-a'),fileB:key('file-b')};
function setupEnv(){
 check(Deno.env.get('SUPABASE_URL')===REF,'PROJECT');
 const url=new URL(Deno.env.get('SUPABASE_DB_URL')!);url.search='';
 Object.assign(harnessEnv,{VERCEL_ENV:'preview',DATABASE_URL:url.href,NEXT_PUBLIC_SUPABASE_URL:REF,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:Deno.env.get('SUPABASE_ANON_KEY'),FARMAKON_STRICT_SESSIONS_ENABLED:'true',FARMAKON_RATE_LIMIT_ENABLED:'true',FARMAKON_RATE_LIMIT_SECRET:crypto.randomUUID()+crypto.randomUUID(),FARMAKON_SYNTHETIC_DELETION_ENABLED:'true',FARMAKON_STAGING_DELETION_SECRET:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),FARMAKON_OWNER_EMAIL:email('owner')});
}
Deno.serve(async req=>{
 if(req.method!=='POST'||Date.now()>EXPIRES||req.headers.get('x-f005-probe')!==NONCE)return new Response('closed',{status:410});
 let action='unknown';
 try{
  setupEnv();const body=await req.json();action=body.action;
  if(!['setup','state','run','resolve','cleanup'].includes(action)||Object.keys(body).some(k=>!['action','fault'].includes(k))||body.fault&&!['storage','db','auth'].includes(body.fault))return Response.json({error:'BAD_REQUEST'},{status:400});
  const admin=createClient(REF,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const users=async()=>await sql`SELECT id,email,raw_app_meta_data FROM auth.users WHERE email IN ${sql(roles.map(email))}`;
  const verify=(u:any)=>check(roles.some(r=>email(r)===u.email)&&u.raw_app_meta_data?.farmakon_f005_fixture===true,'FIXTURE_SCOPE');
  const state=async()=>{
   const us=await users();us.forEach(verify);
   const jobs=await sql`SELECT state,attempts,lease IS NOT NULL AS leased FROM farmakon.deletion_jobs WHERE email=${email('a')}`;
   const b=us.find(u=>u.email===email('b'));
   const bData=b?await sql`SELECT md5(coalesce(string_agg(t::text,',' ORDER BY t::text),'')) AS checksum FROM (SELECT id,data FROM farmakon.activity WHERE user_id=${b.id}::text UNION ALL SELECT id,data FROM farmakon.records WHERE data::jsonb->>'userId'=${b.id}::text)t`:[];
   return {state:jobs[0]?.state??'not_requested',attempts:jobs[0]?.attempts??0,leased:jobs[0]?.leased??false,users:us.length,studentB:!!b,studentBChecksum:bData[0]?.checksum??null,objects:(await sql`SELECT count(*)::int n FROM storage.objects WHERE bucket_id='farmakon' AND name IN ${sql([ids.assetA,ids.assetB])}`)[0].n};
  };
  if(action==='state')return Response.json(await state());
  if(action==='setup'){
   check((await users()).length===0,'FIXTURES_EXIST');const credentials:Record<string,unknown>={};
   for(const r of roles){
    const password=crypto.randomUUID()+crypto.randomUUID();
    const created=await admin.auth.admin.createUser({email:email(r),password,email_confirm:true,app_metadata:{farmakon_test_fixture:r!=='ordinary',farmakon_f005_fixture:true},user_metadata:{name:'F00.5 Synthetic '+r}});
    check(!created.error&&created.data.user,'AUTH_CREATE');const uid=created.data.user!.id;credentials[r]={email:email(r),password,id:uid};
    await sql`INSERT INTO farmakon.members VALUES(${uid},${email(r)},${'F00.5 Synthetic '+r},${Date.now()})`;
    if(r==='a'||r==='b'){
     await sql`INSERT INTO farmakon.enrollments VALUES(${key('enroll-'+r)},${email(r)},${ids.course},${Date.now()+7200000},'f005-synthetic')`;
     await sql`INSERT INTO farmakon.activity VALUES(${key('note-'+r)},${uid},'progress',${ids.lesson},${JSON.stringify({seconds:20,completed:false,note:'F005 private '+r})},${Date.now()})`;
    }
   }
   const put=async(id:string,kind:string,course:string,data:unknown)=>sql`INSERT INTO farmakon.records VALUES(${id},${kind},${course},${JSON.stringify(data)},${Date.now()})`;
   await put(ids.course,'course','',{title:'F00.5 synthetic course',description:'Disposable security fixture',status:'published',price:0,days:365,stage:'المرحلة الثالثة',category:'synthetic',color:'teal'});
   await put(ids.question,'question',ids.course,{title:'Synthetic security question',options:['A','B','C','D'],correct:0,explanation:'Synthetic only',source:'fixture',status:'published',free:false});
   await put(ids.exam,'exam',ids.course,{title:'F00.5 synthetic exam',minutes:30,questionIds:[ids.question],status:'published',free:false});
   for(const r of ['a','b']){
    const user=(credentials[r] as {id:string});const asset=r==='a'?ids.assetA:ids.assetB;
    const uploaded=await admin.storage.from('farmakon').upload(asset,new TextEncoder().encode('%PDF-1.4\n% F005 synthetic fixture\n%%EOF'),{contentType:'application/pdf',cacheControl:'0',upsert:false});check(!uploaded.error,'STORAGE_UPLOAD');
    await sql`UPDATE storage.objects SET owner_id=${user.id},owner=${user.id}::uuid WHERE bucket_id='farmakon' AND name=${asset}`;
    await put(asset,'asset',ids.course,{title:'Synthetic '+r+'.pdf',mime:'application/pdf',size:48,courseId:ids.course,owner:user.id});
    await put(r==='a'?ids.fileA:ids.fileB,'file',ids.course,{title:'F00.5 synthetic '+r,assetId:asset,url:'/api/media?id='+asset,status:'published',free:false,category:'ملخص'});
   }
   await put(ids.lesson,'lesson',ids.course,{title:'F00.5 synthetic lesson',assetId:ids.assetA,url:'/api/media?id='+ids.assetA,minutes:1,order:1,status:'published',free:false,download:true});
   return Response.json({credentials,ids,projectRef:'qfzharpouemueipsrduv',run:RUN});
  }
  if(action==='run'){
   const a=(await users()).find(u=>u.email===email('a'));if(a)verify(a);
   const job=await sql`SELECT user_id FROM farmakon.deletion_jobs WHERE email=${email('a')}`;check(job.length===1,'NO_ACCEPTED_JOB');
   harnessEnv.F005_FAULT=body.fault||'';
   try{const result=await runSyntheticDeletion(job[0].user_id);return Response.json({result,...await state()});}
   catch{return Response.json({blocked:true,...await state()},{status:409});}
   finally{harnessEnv.F005_FAULT='';}
  }
  if(action==='resolve'){
   // Manual resolution deletes only this fixture's shared references, not files.
   await sql`DELETE FROM farmakon.records WHERE id IN ${sql([ids.fileA,ids.lesson])}`;
   return Response.json({resolved:true,...await state()});
  }
  if(action==='cleanup'){
   const us=await users();us.forEach(verify);
   await admin.storage.from('farmakon').remove([ids.assetA,ids.assetB]);
   for(const u of us){
    await sql`DELETE FROM auth.sessions WHERE user_id=${u.id}::uuid`;
    await sql`DELETE FROM farmakon.activity WHERE user_id=${u.id}::text`;
    await sql`DELETE FROM farmakon.enrollments WHERE email=${u.email}`;
    await sql`DELETE FROM farmakon.records WHERE data::jsonb->>'userId'=${u.id}::text`;
    await sql`DELETE FROM farmakon.members WHERE id=${u.id}::text`;
    const deleted=await admin.auth.admin.deleteUser(u.id,false);check(!deleted.error,'CLEANUP_AUTH');
   }
   await sql`DELETE FROM farmakon.records WHERE id IN ${sql(Object.values(ids))}`;
   return Response.json({cleaned:true,...await state()});
  }
 }catch(e){return Response.json({error:'FIXTURE_OPERATION_FAILED',action,code:typeof(e as {code?:string}).code==='string'?String((e as {code?:string}).code).slice(0,10):'none'},{status:500});}
 return new Response('invalid',{status:400});
});
