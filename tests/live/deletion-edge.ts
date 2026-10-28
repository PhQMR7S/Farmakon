// STAGING-ONLY LIVE HARNESS. Deployment tooling replaces the sentinel nonce and
// expiry in memory; never commit an actual authorization nonce or credential.
// Uses the repository's deletion coordinator/store/provider unchanged except
// import aliases and a Deno PostgreSQL adapter. No public/general SQL endpoint.
import {harnessEnv} from './env.ts';
import {createClient} from '@supabase/supabase-js';
import {database,sql} from './edge-db.ts';
import {runSyntheticDeletion} from './provider.ts';
const NONCE='__DEPLOYMENT_NONCE__',EXPIRES=0; // Replace only for an authorized short-lived deployment.
const REF='https://qfzharpouemueipsrduv.supabase.co';
const EMAILS=['f004-delete-live-a-20261027-r2@example.test','f004-delete-live-b-20261027-r2@example.test'];
const PREFIX='f004-live-20261027-r2-';
let running=false;
const check=(value:unknown,stage:string)=>{if(!value)throw Error(stage)};
Deno.serve(async req=>{
 if(req.method!=='POST'||Date.now()>EXPIRES||req.headers.get('x-f004-probe')!==NONCE)return new Response('closed',{status:410});
 if(running)return new Response('busy',{status:409});running=true;
 const ids:string[]=[],paths:string[]=[],results:string[]=[];let stage='scope';
 try{
  check(Deno.env.get('SUPABASE_URL')===REF,'project');
  const url=new URL(Deno.env.get('SUPABASE_DB_URL')!);url.search='';
  harnessEnv.VERCEL_ENV='preview';harnessEnv.DATABASE_URL=url.href;
  harnessEnv.NEXT_PUBLIC_SUPABASE_URL=REF;harnessEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=Deno.env.get('SUPABASE_ANON_KEY');
  harnessEnv.FARMAKON_STRICT_SESSIONS_ENABLED='true';harnessEnv.FARMAKON_RATE_LIMIT_ENABLED='true';
  harnessEnv.FARMAKON_RATE_LIMIT_SECRET=crypto.randomUUID()+crypto.randomUUID();harnessEnv.FARMAKON_SYNTHETIC_DELETION_ENABLED='true';
  harnessEnv.FARMAKON_STAGING_DELETION_SECRET=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  stage='owner-config';
  const owner=await sql`SELECT data::jsonb->>'email' AS email FROM farmakon.settings WHERE id='storage-owner'`;
  check(owner[0]?.email,'owner-config');harnessEnv.FARMAKON_OWNER_EMAIL=owner[0].email;
  const admin=createClient(REF,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const publicKey=Deno.env.get('SUPABASE_ANON_KEY')!;
  const clients=EMAILS.map(()=>createClient(REF,publicKey,{auth:{persistSession:false,autoRefreshToken:false}}));
  const passwords=EMAILS.map(()=>crypto.randomUUID()+crypto.randomUUID());
  stage='existing-fixtures';
  const existing=await sql`SELECT count(*)::int AS n FROM auth.users WHERE email IN ${sql(EMAILS)}`;check(existing[0].n===0,'fixtures-already-exist');
  stage='create';
  for(let i=0;i<2;i++){
   const {data,error}=await admin.auth.admin.createUser({email:EMAILS[i],password:passwords[i],email_confirm:true,app_metadata:{farmakon_test_fixture:true},user_metadata:{name:'f004-e2e-disposable'}});
   check(!error&&data.user,'fixture-create');ids.push(data.user!.id);
  }
  stage='sign-in';
  const tokens:string[]=[];
  for(let i=0;i<2;i++){const {data,error}=await clients[i].auth.signInWithPassword({email:EMAILS[i],password:passwords[i]});check(!error&&data.session,'fixture-login');tokens.push(data.session!.access_token);}
  for(let i=0;i<2;i++){
   await sql`INSERT INTO farmakon.members VALUES(${ids[i]},${EMAILS[i]},'synthetic F00.4',${Date.now()})`;
   await sql`INSERT INTO farmakon.enrollments VALUES(${PREFIX+'enroll-'+i},${EMAILS[i]},${PREFIX+'course'},${Date.now()+600000},'synthetic-f004')`;
   await sql`INSERT INTO farmakon.activity VALUES(${PREFIX+'note-'+i},${ids[i]},'progress',${PREFIX+'lesson'},'{}',${Date.now()})`;
   await sql`INSERT INTO farmakon.records VALUES(${PREFIX+'attempt-'+i},'attempt',${PREFIX+'course'},${JSON.stringify({userId:ids[i],status:'done'})},${Date.now()})`;
  }
  await sql`INSERT INTO farmakon.records VALUES(${PREFIX+'course'},'course','',${JSON.stringify({status:'published'})},${Date.now()})`;
  stage='storage';
  for(let i=0;i<2;i++){
   const path=PREFIX+'private-'+i+'.pdf';paths.push(path);
   const {error}=await admin.storage.from('farmakon').upload(path,new TextEncoder().encode('%PDF-1.4\n% Synthetic F004 only\n%%EOF'),{contentType:'application/pdf',cacheControl:'0',upsert:false});check(!error,'storage-upload');
   // Metadata adjustment applies only to newly created, fixed-name synthetic objects.
   const updated=await sql`UPDATE storage.objects SET owner_id=${ids[i]},owner=${ids[i]}::uuid WHERE bucket_id='farmakon' AND name=${path} RETURNING name`;check(updated.length===1,'storage-fixture-owner');
   await sql`INSERT INTO farmakon.records VALUES(${PREFIX+'file-'+i},'file',${PREFIX+'course'},${JSON.stringify({assetId:path,status:'published',free:true})},${Date.now()})`;
   const {data,error:readError}=await clients[i].storage.from('farmakon').download(path);check(!readError&&data,'storage-authorized-read');
  }
  results.push('real Auth users/login and Storage read passed');
  stage='accept';
  await database.transaction(async()=>{await database.prepare("INSERT INTO farmakon.deletion_jobs(user_id,email,policy,created,updated) VALUES(?,?,'synthetic-v1',?,?)").bind(ids[0],EMAILS[0],Date.now(),Date.now()).run();});
  const claims=JSON.parse(atob(tokens[0].split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
  const active=await sql`SELECT farmakon.session_is_active(${claims.session_id}::uuid,${ids[0]}::uuid) AS active`;check(active[0].active===false,'accepted-session-deny');
  const oldClient=createClient(REF,publicKey,{global:{headers:{Authorization:'Bearer '+tokens[0]}},auth:{persistSession:false,autoRefreshToken:false}});
  check(!!(await oldClient.storage.from('farmakon').download(paths[0],{cacheNonce:crypto.randomUUID()},{cache:'no-store'})).error,'old-jwt-storage-deny');
  results.push('accepted tombstone denies existing session and direct Storage JWT');
  stage='shared-file-block';
  // Existing free file reference is shared: worker must stop, not delete it.
  await runSyntheticDeletion(ids[0]).then(()=>{throw Error('shared-file-not-blocked')},()=>{});
  const stopped=await sql`SELECT state FROM farmakon.deletion_jobs WHERE user_id=${ids[0]}::uuid`;check(stopped[0].state==='sessions_revoked','resumable-shared-state');
  const banned=await createClient(REF,publicKey,{auth:{persistSession:false}}).auth.signInWithPassword({email:EMAILS[0],password:passwords[0]});check(!!banned.error,'ban-login-deny');
  // Manual review removes ONLY the synthetic sharing reference, then resumes.
  await sql`DELETE FROM farmakon.records WHERE id=${PREFIX+'file-0'}`;
  stage='resume-delete';
  check(await runSyntheticDeletion(ids[0])==='complete','worker-complete');
  const a=await admin.auth.admin.getUserById(ids[0]);check(!!a.error,'auth-gone');
  check(!!(await admin.storage.from('farmakon').download(paths[0])).error,'object-gone');
  check(!(await admin.auth.admin.getUserById(ids[1])).error,'other-user-intact');
  check(!(await clients[1].storage.from('farmakon').download(paths[1])).error,'other-file-intact');
  check((await sql`SELECT count(*)::int n FROM farmakon.activity WHERE user_id=${ids[0]}`)[0].n===0,'notes-gone');
  check((await sql`SELECT count(*)::int n FROM farmakon.records WHERE id=${PREFIX+'attempt-0'}`)[0].n===0,'attempt-gone');
  check((await sql`SELECT count(*)::int n FROM auth.sessions WHERE user_id=${ids[0]}::uuid`)[0].n===0,'sessions-gone');
  check(!!(await createClient(REF,publicKey,{auth:{persistSession:false}}).auth.signInWithPassword({email:EMAILS[0],password:passwords[0]})).error,'deleted-login-denied');
  check(!!(await oldClient.auth.updateUser({data:{name:'forbidden'}})).error,'deleted-user-update-denied');
  results.push('worker resumed; Auth and owned object deleted; notes/attempts/sessions removed; login/update denied; second student/file intact');
  // End-to-end Preview HTTP remains a separate protected deployment gate.
  return Response.json({passed:true,results,scope:'real Staging Auth/Storage/Postgres; exact deletion coordinator/store/provider; Deno SQL transport',blocked:'new Next deletion UI/API not deployed; natural JWT/email and full provider DR remain open'});
 }catch(error){return Response.json({passed:false,stage,reason:error instanceof Error&&/^[a-z0-9-]+$/.test(error.message)?error.message:'provider-or-database-failure',code:typeof (error as {code?:string}).code==='string'?String((error as {code?:string}).code).replace(/[^A-Z0-9_]/g,'').slice(0,32):'none'},{status:500});}
 finally{
  // Cleanup is deliberately exact-target and guarded, never an email wildcard.
  try{
   const admin=createClient(REF,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
   for(let i=0;i<ids.length;i++){
    const u=await admin.auth.admin.getUserById(ids[i]);
    if(u.data.user&&(u.data.user.email!==EMAILS[i]||u.data.user.app_metadata?.farmakon_test_fixture!==true))continue;
    if(paths[i])await admin.storage.from('farmakon').remove([paths[i]]);
    await sql`DELETE FROM auth.sessions WHERE user_id=${ids[i]}::uuid`;
    await sql`DELETE FROM farmakon.activity WHERE user_id=${ids[i]}`;
    await sql`DELETE FROM farmakon.enrollments WHERE email=${EMAILS[i]}`;
    await sql`DELETE FROM farmakon.records WHERE id IN ${sql([PREFIX+'attempt-'+i,PREFIX+'file-'+i])}`;
    await sql`DELETE FROM farmakon.members WHERE id=${ids[i]}`;
    if(u.data.user)await admin.auth.admin.deleteUser(ids[i],false);
   }
   await sql`DELETE FROM farmakon.records WHERE id=${PREFIX+'course'}`;
  }catch{/* Final aggregate audit must independently prove cleanup. */}
  running=false;
 }
});
