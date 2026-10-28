// Real localhost Auth/Storage/Mailpit + actual Next HTTP callback. No cloud URLs.
import assert from 'node:assert/strict';
import {readFileSync,openSync,closeSync} from 'node:fs';
import {execFileSync,spawn} from 'node:child_process';
import {randomBytes,createHash} from 'node:crypto';
import {dirname,join} from 'node:path';
import pg from 'pg';
const [statusPath,project]=process.argv.slice(2);
assert.match(project||'',/^f0010-[0-9]+-[12]$/);
const config=JSON.parse(readFileSync(statusPath,'utf8'));
const local=value=>{const u=new URL(value);assert.equal(u.hostname,'127.0.0.1');return u;};
const api=local(config.API_URL).origin,dbURL=local(config.DB_URL),app='http://127.0.0.1:3000',mail='http://127.0.0.1:54324';
assert.equal(api,'http://127.0.0.1:54321');assert.equal(dbURL.port,'54322');
assert.ok(config.ANON_KEY&&config.SERVICE_ROLE_KEY);
const publicKey=config.ANON_KEY,adminKey=config.SERVICE_ROLE_KEY;
const rawFetch=globalThis.fetch;
const fetchLocal=(url,options={})=>{const u=local(String(url));assert.ok(['54321','54324','3000'].includes(u.port));return rawFetch(u,{...options,redirect:'manual',signal:AbortSignal.timeout(15000)});};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const sha=b=>createHash('sha256').update(b).digest('hex');
let stage='ports',server,db,logFd;
const checks=[];
function passed(name){checks.push(name);console.log(JSON.stringify({phase:'check',name,result:'passed'}));}
async function auth(path,body,token,key=publicKey,method='POST'){
 const r=await fetchLocal(api+'/auth/v1/'+path,{method,headers:{apikey:key,...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 let data;try{data=await r.json();}catch{data={};}return {status:r.status,data};
}
function cookieJar(){return new Map();}
function cookies(jar){return [...jar].map(([k,v])=>k+'='+v).join('; ');}
function absorb(r,jar){for(const value of r.headers.getSetCookie()){const [pair]=value.split(';'),i=pair.indexOf('=');if(i>0){const name=pair.slice(0,i),v=pair.slice(i+1);if(v)jar.set(name,v);else jar.delete(name);}}}
async function appReq(path,jar,body){const r=await fetchLocal(app+path,{method:body?'POST':'GET',headers:{Origin:app,Cookie:cookies(jar),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});absorb(r,jar);return r;}
async function messageLink(email){
 for(let i=0;i<30;i++){
  const r=await fetchLocal(mail+'/api/v1/messages');assert.equal(r.status,200);const inbox=await r.json();
  const msg=inbox.messages?.find(m=>m.To?.some(t=>t.Address===email));
  if(msg){const full=await (await fetchLocal(mail+'/api/v1/message/'+msg.ID)).json();
   const text=full.HTML||full.Text||'',links=[...text.matchAll(/https?:[^\s"'<>]+/g)].map(m=>m[0].replaceAll('&amp;','&'));
   const link=links.find(s=>{try{return new URL(s).pathname==='/auth/v1/verify';}catch{return false;}});
   if(link){assert.equal(local(link).origin,api);return link;}
  }
  await sleep(250);
 }
 throw Error('MAIL_LOCAL_TIMEOUT');
}
async function consumeMail(link,jar,next='/'){
 const r=await fetchLocal(link);assert.ok([302,303,307].includes(r.status));
 const callback=new URL(r.headers.get('location'));assert.equal(callback.origin,app);assert.equal(callback.pathname,'/auth/callback');assert.ok(callback.searchParams.has('code'));
 const response=await appReq(callback.pathname+callback.search,jar);assert.equal(response.status,307);assert.equal(new URL(response.headers.get('location')).pathname,next);return callback;
}
async function storage(path,token,method='GET',body,extra={}){
 return fetchLocal(api+'/storage/v1/'+path,{method,headers:{apikey:publicKey,...(token?{Authorization:'Bearer '+token}:{}),...extra},...(body===undefined?{}:{body})});
}
try{
 const ids=execFileSync('docker',['ps','-q','--filter','label=com.supabase.cli.project='+project],{encoding:'utf8'}).trim().split('\n').filter(Boolean);assert.ok(ids.length>=5);
 const inspected=JSON.parse(execFileSync('docker',['inspect',...ids],{encoding:'utf8'}));
 for(const c of inspected)for(const bindings of Object.values(c.NetworkSettings.Ports||{}))for(const p of bindings||[])assert.equal(p.HostIp,'127.0.0.1');
 console.log(JSON.stringify({phase:'services',images:inspected.map(c=>c.Config.Image),loopbackOnly:true}));passed('loopback-ports');
 stage='reviewed-local-sql';
 db=new pg.Client({connectionString:dbURL.href,ssl:false});await db.connect();
 for(const path of ['scripts/staging/bootstrap.sql','supabase/migrations/20261026060742_p0_rate_limits.sql','scripts/staging/20261026081826_p0_staging_storage.sql','scripts/staging/20261026121218_p0_staging_sessions.sql'])await db.query(readFileSync(path,'utf8'));
 // No automatic repo migrations: F00.7 index and synthetic deletion worker are excluded.
 passed('reviewed-farmakon-schema-and-storage-policies');
 stage='next-start';
 logFd=openSync(join(dirname(statusPath),'next-private.log'),'w',0o600);
 const appDB=new URL(dbURL);appDB.searchParams.set('sslmode','disable'); // Disposable loopback only, no runtime change.
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p','3000'],{env:{PATH:process.env.PATH,HOME:process.env.HOME,NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1',NEXT_PUBLIC_SUPABASE_URL:api,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:publicKey,DATABASE_URL:appDB.href,FARMAKON_STRICT_SESSIONS_ENABLED:'true',FARMAKON_RATE_LIMIT_ENABLED:'true',FARMAKON_RATE_LIMIT_SECRET:randomBytes(32).toString('hex'),FARMAKON_SYNTHETIC_DELETION_ENABLED:'false'},stdio:['ignore',logFd,logFd]});
 let ready=false;for(let i=0;i<60;i++){try{const r=await fetchLocal(app+'/login');if(r.status===200){ready=true;break;}}catch{}await sleep(500);}assert.ok(ready);
 const suffix=randomBytes(6).toString('hex'),password=randomBytes(24).toString('base64url')+'aA1!',users=[];
 stage='signup-mail-callback';
 for(const letter of ['a','b']){
  const email='f0010-'+letter+'-'+suffix+'@example.test',jar=cookieJar();
  const signup=await appReq('/api/auth',jar,{action:'signup',email,password,name:'Synthetic '+letter});assert.equal(signup.status,200);
  const unconfirmed=await auth('token?grant_type=password',{email,password});assert.equal(unconfirmed.status,400);
  const link=await messageLink(email),callback=await consumeMail(link,jar);
  const replay=await appReq(callback.pathname+callback.search,jar);assert.equal(new URL(replay.headers.get('location')).pathname,'/login');
  const login=await auth('token?grant_type=password',{email,password});assert.equal(login.status,200);assert.ok(login.data.access_token);
  users.push({email,jar,session:login.data,id:login.data.user.id});
 }
 passed('two-local-signups-confirmation-mailpit-pkce-callback-and-replay');
 stage='callback-refusal';
 const refused=await appReq('/auth/callback?code=a&code=b&next=https://outside.invalid',cookieJar());assert.equal(new URL(refused.headers.get('location')).origin,app);assert.equal(new URL(refused.headers.get('location')).pathname,'/login');
 // Real local PKCE exchange with valid code but hostile next: actual app allowlist wins.
 const thirdEmail='f0010-redirect-'+suffix+'@example.test',thirdJar=cookieJar();assert.equal((await appReq('/api/auth',thirdJar,{action:'signup',email:thirdEmail,password,name:'Synthetic redirect'})).status,200);
 const thirdLink=await messageLink(thirdEmail),provider=await fetchLocal(thirdLink);const cb=new URL(provider.headers.get('location'));assert.equal(cb.origin,app);cb.searchParams.set('next','https://outside.invalid');
 const redirected=await appReq(cb.pathname+cb.search,thirdJar);assert.equal(new URL(redirected.headers.get('location')).href,app+'/');passed('actual-callback-rejects-malformed-and-external-next');
 stage='recovery-mail';
 const a=users[0],b=users[1],recoveryJar=cookieJar(),newPassword=randomBytes(24).toString('base64url')+'bB2!';
 const recover=await appReq('/api/auth',recoveryJar,{action:'forgot',email:a.email});assert.equal(recover.status,200);
 // Poll the newest recovery message, not the old confirmation.
 await sleep(1100);
 const recoverLink=await messageLink(a.email);assert.ok(new URL(recoverLink).searchParams.get('type')==='recovery');
 await consumeMail(recoverLink,recoveryJar,'/reset-password');
 assert.equal((await appReq('/api/auth',recoveryJar,{action:'reset',password:newPassword})).status,200);
 assert.equal((await auth('token?grant_type=password',{email:a.email,password:newPassword})).status,200);
 assert.equal((await auth('token?grant_type=password',{email:a.email,password})).status,400);
 passed('local-mailpit-recovery-actual-reset-and-new-password-login');
 stage='two-devices';
 const first=await auth('token?grant_type=password',{email:b.email,password}),second=await auth('token?grant_type=password',{email:b.email,password});assert.equal(first.status,200);assert.equal(second.status,200);
 const claims=s=>JSON.parse(Buffer.from(s.access_token.split('.')[1],'base64url').toString());
 assert.notEqual(claims(first.data).session_id,claims(second.data).session_id);
 assert.equal((await auth('logout?scope=local',undefined,first.data.access_token)).status,204);
 const active=await db.query('select farmakon.session_is_active($1,$2) as active',[claims(first.data).session_id,b.id]);assert.equal(active.rows[0].active,false);
 assert.equal((await auth('user',undefined,second.data.access_token,publicKey,'GET')).status,200);
 assert.equal((await auth('token?grant_type=refresh_token',{refresh_token:first.data.refresh_token})).status,400);
 passed('real-two-device-local-logout-session-helper-and-refresh-denial');
 stage='next-revocation';
 const appDevice=cookieJar();assert.equal((await appReq('/api/auth',appDevice,{action:'login',email:b.email,password})).status,200);
 assert.equal((await appReq('/api/platform',appDevice)).status,200);
 const oldCookies=new Map(appDevice);assert.equal((await appReq('/api/auth',appDevice,{action:'logout'})).status,200);
 for(const path of ['/api/platform','/api/media?id=f0010-none','/api/account/export'])assert.equal((await appReq(path,new Map(oldCookies))).status,401);
 passed('actual-next-platform-media-export-deny-revoked-cookies');
 stage='owner-storage-fixtures';
 const ownerEmail='f0010-owner-'+suffix+'@example.test';const owner=await auth('admin/users',{email:ownerEmail,password,email_confirm:true},adminKey,adminKey);assert.equal(owner.status,200);
 const ownerLogin=await auth('token?grant_type=password',{email:ownerEmail,password});assert.equal(ownerLogin.status,200);
 await db.query("insert into farmakon.settings values('storage-owner',$1)",[JSON.stringify({email:ownerEmail})]);
 const files=[];
 for(const [i,u] of users.entries()){
  const course='f0010-course-'+i,name='f0010-'+i+'.pdf',bytes=Buffer.from('%PDF-1.4\nSynthetic '+i+'\n%%EOF\n');
  await db.query('insert into farmakon.records values($1,$2,$3,$4,0)',['f0010-course-'+i,'course','',JSON.stringify({status:'published',title:'Synthetic'})]);
  await db.query('insert into farmakon.records values($1,$2,$3,$4,0)',['f0010-file-'+i,'file',course,JSON.stringify({status:'published',assetId:name})]);
  await db.query('insert into farmakon.enrollments values($1,$2,$3,$4,$5)',['f0010-enrollment-'+i,u.email,course,Date.now()+600000,'synthetic']);
  const upload=await storage('object/farmakon/'+name,ownerLogin.data.access_token,'POST',bytes,{'Content-Type':'application/pdf','Cache-Control':'no-store'});assert.equal(upload.status,200);
  files.push({name,bytes});
 }
 passed('private-bucket-real-owner-uploads-two-pdfs');
 stage='storage-rls';
 const freshA=await auth('token?grant_type=password',{email:a.email,password:newPassword}),freshB=await auth('token?grant_type=password',{email:b.email,password});
 const tokens=[freshA.data.access_token,freshB.data.access_token];
 for(let i=0;i<2;i++){
  const own=await storage('object/authenticated/farmakon/'+files[i].name,tokens[i]);assert.equal(own.status,200);assert.equal(sha(Buffer.from(await own.arrayBuffer())),sha(files[i].bytes));
  const denied=await storage('object/authenticated/farmakon/'+files[1-i].name,tokens[i]);assert.notEqual(denied.status,200);
 }
 const anon=await storage('object/authenticated/farmakon/'+files[0].name);assert.notEqual(anon.status,200);
 const revoked=await storage('object/authenticated/farmakon/'+files[1].name,first.data.access_token);assert.notEqual(revoked.status,200);
 const list=await storage('object/list/farmakon',tokens[0],'POST',JSON.stringify({prefix:'',limit:100}),{'Content-Type':'application/json'});assert.equal(list.status,200);assert.deepEqual((await list.json()).map(f=>f.name),[files[0].name]);
 passed('real-farmakon-rls-two-student-isolation-anonymous-revoked-metadata-sha256');
 stage='signed-and-expiry';
 const sign=await storage('object/sign/farmakon/'+files[1].name,tokens[1],'POST',JSON.stringify({expiresIn:5}),{'Content-Type':'application/json'});assert.equal(sign.status,200);const signed=(await sign.json()).signedURL;assert.ok(signed?.startsWith('/object/sign/'));
 const signedUrl=api+'/storage/v1'+signed;assert.equal((await fetchLocal(signedUrl,{headers:{'Cache-Control':'no-store'}})).status,200);
 const original=second.data,c=claims(original);assert.ok(c.exp>c.iat);assert.ok(c.exp-c.iat<=100);console.log(JSON.stringify({phase:'jwt',lifetimeSeconds:c.exp-c.iat,clock:'runner-real-wall-clock'}));
 // Wait for actual exp; no fake JWT or clock manipulation. Never log token values.
 const wait=Math.max(0,c.exp*1000-Date.now()+2000);assert.ok(wait<=100000);await sleep(wait);
 assert.notEqual((await auth('user',undefined,original.access_token,publicKey,'GET')).status,200);
 assert.notEqual((await fetchLocal(signedUrl,{headers:{'Cache-Control':'no-store'}})).status,200);
 const refreshed=await auth('token?grant_type=refresh_token',{refresh_token:original.refresh_token});assert.equal(refreshed.status,200);assert.ok(claims(refreshed.data).exp>c.exp);
 assert.notEqual(refreshed.data.refresh_token,original.refresh_token);assert.equal(claims(refreshed.data).session_id,c.session_id);
 assert.equal((await auth('user',undefined,refreshed.data.access_token,publicKey,'GET')).status,200);
 assert.equal((await storage('object/authenticated/farmakon/'+files[1].name,original.access_token)).status===200,false);
 passed('natural-local-jwt-expiry-refresh-and-signed-url-expiry');
 stage='global-logout';
 assert.equal((await auth('logout?scope=global',undefined,refreshed.data.access_token)).status,204);
 const status=await db.query('select farmakon.session_is_active($1,$2) as active',[claims(refreshed.data).session_id,b.id]);assert.equal(status.rows[0].active,false);
 assert.notEqual((await storage('object/authenticated/farmakon/'+files[1].name,refreshed.data.access_token)).status,200);
 passed('global-logout-denies-storage-with-unexpired-jwt');
 stage='delete-synthetic-objects';
 const del=await fetchLocal(api+'/storage/v1/object/farmakon',{method:'DELETE',headers:{apikey:adminKey,Authorization:'Bearer '+adminKey,'Content-Type':'application/json'},body:JSON.stringify({prefixes:files.map(f=>f.name)})});assert.equal(del.status,200);
 assert.equal((await db.query("select count(*)::int as n from storage.objects where bucket_id='farmakon'")).rows[0].n,0);
 for(const file of files)assert.notEqual((await storage('object/authenticated/farmakon/'+file.name,tokens[0])).status,200);
 passed('delete-objects');
 console.log(JSON.stringify({result:'PASS_LOCAL',checks:checks.length,provider:'actual-local-Supabase',email:'Mailpit-only',cloud:'not-tested',disasterRecovery:'not-performed'}));
}catch(error){console.log(JSON.stringify({result:'FAIL_LOCAL',stage,completed:checks.length,errorType:error?.name||'Error',expected:error?.expected!==undefined?String(error.expected).slice(0,40):undefined,actual:typeof error?.actual==='number'?error.actual:undefined}));process.exitCode=1;
}finally{
 if(server){server.kill('SIGTERM');await Promise.race([new Promise(resolve=>server.once('exit',resolve)),sleep(5000)]);if(server.exitCode===null)server.kill('SIGKILL');}
 if(db)await db.end().catch(()=>{});if(logFd!==undefined)closeSync(logFd);
}
