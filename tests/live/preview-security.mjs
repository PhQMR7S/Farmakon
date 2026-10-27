// Real protected Preview E2E; never invoked by ordinary CI. No transport mocks.
// Credentials, cookies and signed URLs remain in a mode-0600 temporary control
// directory or memory; only stage names/status codes enter safe evidence.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createServerClient} from '@supabase/ssr';
import {chromium,devices} from '@playwright/test';
const file=process.argv[2];if(!file?.startsWith('/tmp/farmakon-f005-'))throw Error('Private control directory required');
const dir=path.dirname(file),control=JSON.parse(fs.readFileSync(file,'utf8')),fixture=JSON.parse(fs.readFileSync(path.join(dir,'fixtures.json'),'utf8'));
const origin=new URL(control.preview);if(control.target!=='staging'||!control.deploymentId?.startsWith('dpl_')||origin.protocol!=='https:'||!origin.hostname.endsWith('-phqmr7s.vercel.app')||fixture.projectRef!=='qfzharpouemueipsrduv')throw Error('Reviewed Staging deployment required');
const evidence=[],contexts=[];let stage='launch',browser;
const check=(ok,label)=>{if(!ok)throw Error(label)};
const record=(name,result='Passed',status)=>{evidence.push({name,result,...(status===undefined?{}:{status})});console.log(JSON.stringify(evidence.at(-1)));};
function edge(action,fault){const args=[path.join(dir,'call.py'),action,...(fault?[fault]:[])];const r=JSON.parse(execFileSync('python',args,{timeout:130000,maxBuffer:100000}).toString());check([200,409].includes(r.status),'edge-operation');return r;}
async function context(device){
 const ctx=await browser.newContext({...device,baseURL:origin.origin});contexts.push(ctx);
 const access=new URL('/api/health',origin);access.searchParams.set('_vercel_share',control.share);
 const grant=await ctx.request.get(access.href,{maxRedirects:0});const location=grant.headers().location;
 check(!location||new URL(location,origin).origin===origin.origin,'protection-origin');return {ctx,page:await ctx.newPage()};
}
async function call(s,p,body,cookie){return s.ctx.request.fetch(origin.origin+p,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{Origin:origin.origin,'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{})},...(body===undefined?{}:{data:body}),maxRedirects:0,timeout:30000});}
async function login(s,role){
 await s.page.goto('/login');await s.page.getByLabel('البريد الإلكتروني').fill(fixture.credentials[role].email);await s.page.getByLabel(/^كلمة المرور/).fill(fixture.credentials[role].password);
 const response=s.page.waitForResponse(r=>new URL(r.url()).pathname==='/api/auth'&&r.request().method()==='POST');
 await s.page.getByRole('button',{name:'دخول',exact:true}).click();check((await response).status()===200,'login-http');await s.page.waitForURL(u=>u.pathname==='/'&&u.origin===origin.origin);check((await call(s,'/api/platform')).status()===200,'platform-authorized');
}
async function eligibility(s,status){
 await s.page.goto('/account/delete');await s.page.getByRole('heading',{name:'حذف حساب الاختبار'}).waitFor();
 const r=await call(s,'/api/account/delete');check(r.status()===status,'eligibility-status');
 if(status!==200){await s.page.getByRole('status').waitFor();check(await s.page.getByLabel('كلمة المرور الحالية').count()===0,'denied-form-hidden');}
 else await s.page.getByLabel('كلمة المرور الحالية').waitFor();
}
async function seedCache(s){await s.page.evaluate(async({asset})=>{const c=await caches.open('farmakon-downloads-v1');await c.put('/api/media?id='+asset,new Response('F005 synthetic copy',{headers:{'x-offline-until':String(Date.now()+600000)}}));await caches.open('unrelated-f005-cache');},{asset:fixture.ids.assetA});}
async function deniedMatrix(s,cookie,label,attempt){
 for(const [name,p,body] of [
  ['platform-get','/api/platform'],['platform-post','/api/platform',{action:'ticket',title:'F005 blocked',description:'Must not persist'}],
  ['progress','/api/platform',{action:'progress',id:fixture.ids.lesson,data:{seconds:1,completed:false,note:'blocked'}}],
  ['exam-start','/api/platform',{action:'startExam',id:fixture.ids.exam}],['exam-save','/api/platform',{action:'saveExam',id:attempt,answers:{}}],['exam-submit','/api/platform',{action:'submitExam',id:attempt,answers:{}}],
  ['media','/api/media?id='+fixture.ids.assetA],['export','/api/account/export',{}],
  ['password-reset','/api/auth',{action:'reset',password:fixture.credentials.a.password}],['duplicate-delete','/api/account/delete',{confirmation:'DELETE SYNTHETIC ACCOUNT',password:fixture.credentials.a.password}]
 ]){const r=await call(s,p,body,cookie);check(r.status()===401,label+'-'+name);}
 record(label+' Next platform/media/export/exam/reset/stale-cookie matrix', 'Passed',401);
}
try{
 const proxyURL=process.env.HTTPS_PROXY?new URL(process.env.HTTPS_PROXY):null;
 browser=await chromium.launch({executablePath:process.env.FARMAKON_TEST_CHROMIUM||'/tmp/f005-browser/runtime/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'],...(proxyURL?{proxy:{server:proxyURL.origin,...(proxyURL.username?{username:decodeURIComponent(proxyURL.username),password:decodeURIComponent(proxyURL.password)}:{})}}:{})});
 const anon=await context(devices['Desktop Chrome']);stage='anonymous';const health=await call(anon,'/api/health');check(health.status()===200&&(await health.json()).database===true,'health');await eligibility(anon,401);check((await call(anon,'/api/account/delete',{confirmation:'DELETE SYNTHETIC ACCOUNT',password:'invalid'})).status()===401,'anonymous-mutation');record('protected health and anonymous UI/API denial','Passed',401);
 const owner=await context(devices['Desktop Chrome']);stage='synthetic-owner';await login(owner,'owner');await eligibility(owner,403);check((await call(owner,'/api/account/delete',{confirmation:'DELETE SYNTHETIC ACCOUNT',password:fixture.credentials.owner.password})).status()===403,'owner-mutation');record('synthetic owner UI/API protected','Passed',403);
 const ordinary=await context(devices['Desktop Chrome']);stage='ordinary';await login(ordinary,'ordinary');await eligibility(ordinary,403);check((await call(ordinary,'/api/account/delete',{confirmation:'DELETE SYNTHETIC ACCOUNT',password:fixture.credentials.ordinary.password})).status()===403,'ordinary-mutation');check((await call(ordinary,'/api/account/delete',{confirmation:'DELETE SYNTHETIC ACCOUNT',password:fixture.credentials.ordinary.password,userId:fixture.credentials.b.id})).status()===400,'idor');record('unmarked student UI/API and target-user injection rejected','Passed',403);
 const a=await context(devices['Desktop Chrome']),mobile=await context(devices['Pixel 7']),b=await context(devices['Desktop Chrome']);
 stage='two-devices';await login(a,'a');await login(mobile,'a');await login(b,'b');await eligibility(a,200);await eligibility(mobile,200);
 const beforeA=await (await call(a,'/api/platform')).json(),beforeB=await (await call(b,'/api/platform')).json();check(beforeA.user.id===fixture.credentials.a.id&&beforeB.user.id===fixture.credentials.b.id,'identity-binding');check(beforeB.activity.every(x=>x.user_id===fixture.credentials.b.id),'control-notes-isolation');
 check((await call(a,'/api/media?id='+fixture.ids.assetA)).status()===200,'initial-media');check((await call(b,'/api/media?id='+fixture.ids.assetB)).status()===200,'control-media');
 const start=await call(a,'/api/platform',{action:'startExam',id:fixture.ids.exam});check(start.status()===200,'start-exam');const attempt=(await start.json()).id;check(!!attempt,'attempt-id');check((await call(a,'/api/platform',{action:'saveExam',id:attempt,answers:{[fixture.ids.question]:0}})).status()===200,'save-exam');
 const beforeExport=await call(b,'/api/account/export',{});check(beforeExport.status()===200,'control-export');const bExport=await beforeExport.json();check(bExport.activity.every(x=>!JSON.stringify(x).includes('private a')),'export-isolation');const controlState=edge('state').result;
 const oldCookies=await a.ctx.cookies(origin.origin),oldCookie=oldCookies.map(c=>c.name+'='+c.value).join('; '),secondCookie=(await mobile.ctx.cookies(origin.origin)).map(c=>c.name+'='+c.value).join('; ');
 const sdk=createServerClient('https://qfzharpouemueipsrduv.supabase.co',control.publicKey,{cookies:{getAll:()=>oldCookies,setAll(){}}});const token=(await sdk.auth.getSession()).data.session?.access_token;check(!!token,'real-access-token');
 const signed=await a.ctx.request.post('https://qfzharpouemueipsrduv.supabase.co/storage/v1/object/sign/farmakon/'+fixture.ids.assetA,{headers:{apikey:control.publicKey,Authorization:'Bearer '+token},data:{expiresIn:10}});check(signed.status()===200,'signed-url');const signedPath=(await signed.json()).signedURL;check(typeof signedPath==='string','signed-path');const signedURL='https://qfzharpouemueipsrduv.supabase.co/storage/v1'+signedPath;check((await a.ctx.request.get(signedURL)).status()===200,'signed-before');const signedAt=Date.now();
 record('two real A sessions, populated independent B, media/exam/export before deletion');
 stage='wrong-password';const csrf=await a.ctx.request.post(origin.origin+'/api/account/delete',{headers:{Origin:'https://evil.example.test'},data:{confirmation:'DELETE SYNTHETIC ACCOUNT',password:fixture.credentials.a.password}});check(csrf.status()===403,'csrf');
 await a.page.getByLabel('كلمة المرور الحالية').fill('wrong-f005-password');await a.page.getByLabel('للتأكيد اكتب DELETE SYNTHETIC ACCOUNT').fill('DELETE SYNTHETIC ACCOUNT');let response=a.page.waitForResponse(r=>new URL(r.url()).pathname==='/api/account/delete'&&r.request().method()==='POST');await a.page.getByRole('button',{name:'تأكيد حذف حساب الاختبار'}).click();check((await response).status()===401,'wrong-password-status');await a.page.getByRole('status').filter({hasText:'سجّل الدخول'}).waitFor();check(!(await a.page.getByRole('button',{name:'تأكيد حذف حساب الاختبار'}).isDisabled()),'wrong-password-unfrozen');record('CSRF and incorrect password rejected; form remains usable','Passed',401);
 stage='accept-browser';await seedCache(a);await seedCache(mobile);
 await a.page.evaluate(()=>{const original=caches.delete.bind(caches);globalThis.__f005Delete=original;caches.delete=async key=>{if(key==='farmakon-downloads-v1')throw Error('synthetic browser storage failure');return original(key)}});
 await a.page.getByLabel('كلمة المرور الحالية').fill(fixture.credentials.a.password);
 // Keyboard submission proves the actual form path; parallel request exercises
 // the idempotent insertion race without submitting another user's ID.
 const sent=a.page.waitForRequest(r=>new URL(r.url()).pathname==='/api/account/delete'&&r.method()==='POST');
 response=a.page.waitForResponse(r=>new URL(r.url()).pathname==='/api/account/delete'&&r.request().method()==='POST');
 await a.page.getByLabel('للتأكيد اكتب DELETE SYNTHETIC ACCOUNT').focus();await a.page.keyboard.press('Enter');await sent;
 const parallel=call(a,'/api/account/delete',{confirmation:'DELETE SYNTHETIC ACCOUNT',password:fixture.credentials.a.password},oldCookie);
 check((await response).status()===202,'ui-accepted');check([202,401,429].includes((await parallel).status()),'parallel-request');
 await a.page.getByRole('status').filter({hasText:'امسح بيانات الموقع'}).waitFor();check(await a.page.getByRole('button',{name:'تأكيد حذف حساب الاختبار'}).isDisabled(),'accepted-disabled');check(await a.page.getByLabel('كلمة المرور الحالية').inputValue()==='','password-cleared');
 check((await a.page.locator('body').innerText()).includes('القبول ليس اكتمالاً للحذف'),'pending-wording');check(await a.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'desktop-width');
 fs.mkdirSync('docs/evidence',{recursive:true});await a.page.locator('main').screenshot({path:'docs/evidence/F00.5-live-delete-accepted-desktop.png'});
 await a.page.evaluate(async()=>{caches.delete=globalThis.__f005Delete;await caches.delete('farmakon-downloads-v1')});
 record('browser accepted=202; concurrent duplicate safe; pending wording and cache-failure instructions','Passed',202);
 const acceptedState=edge('state').result;check(acceptedState.state==='accepted'&&acceptedState.studentBChecksum===controlState.studentBChecksum,'accepted-state');
 stage='accepted-denial';await deniedMatrix(a,oldCookie,'accepted primary device',attempt);await deniedMatrix(mobile,secondCookie,'accepted second device',attempt);
 const freshStorage=await a.ctx.request.get('https://qfzharpouemueipsrduv.supabase.co/storage/v1/object/farmakon/'+fixture.ids.assetA+'?cacheNonce='+Date.now(),{headers:{apikey:control.publicKey,Authorization:'Bearer '+token,'Cache-Control':'no-cache'}});check(freshStorage.status()>=400,'direct-storage-denied');record('Supabase Storage direct fresh JWT request denied separately','Passed',freshStorage.status());
 await mobile.page.goto('/');await mobile.page.waitForURL(u=>u.pathname==='/login');check(!(await mobile.page.evaluate(()=>caches.keys())).includes('farmakon-downloads-v1'),'mobile-401-cache-cleared');check(await mobile.page.evaluate(()=>localStorage.getItem('farmakon-device-user'))===null,'mobile-marker-cleared');check(await mobile.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile-width');await mobile.page.locator('main').screenshot({path:'docs/evidence/F00.5-live-second-device-denied-mobile.png'});record('Android second device redirects to login and clears local downloads');
 stage='worker-shared';const shared=edge('run');check(shared.status===409&&shared.result.state==='sessions_revoked','shared-stop');check(shared.result.objects===2,'shared-objects-not-deleted');record('real worker stops safely at shared reference after session revocation');
 edge('resolve');
 for(const [fault,state] of [['storage','sessions_revoked'],['db','files_removed'],['auth','data_removed']]){stage='worker-fault-'+fault;const r=edge('run',fault);check(r.status===409&&r.result.state===state&&!r.result.leased,'fault-stage');check(r.result.studentBChecksum===controlState.studentBChecksum,'control-stable');record('worker '+fault+' injected boundary failure remains resumable at '+state);}
 stage='worker-complete';const complete=edge('run');check(complete.status===200&&complete.result.state==='complete'&&complete.result.studentB,'complete');check(edge('run').result.state==='complete','repeat-complete');record('real worker completes Auth/Storage/data deletion; repeat does not rerun destruction');
 stage='deleted-denial';await deniedMatrix(a,oldCookie,'deleted primary device',attempt);await deniedMatrix(mobile,secondCookie,'deleted second device',attempt);
 const again=await call(a,'/api/auth',{action:'login',email:fixture.credentials.a.email,password:fixture.credentials.a.password});check(again.status()===400,'deleted-login');record('real Next login rejects deleted Auth identity','Passed',400);
 const authUpdate=await a.ctx.request.put('https://qfzharpouemueipsrduv.supabase.co/auth/v1/user',{headers:{apikey:control.publicKey,Authorization:'Bearer '+token},data:{password:fixture.credentials.a.password}});check(authUpdate.status()>=400,'direct-auth-update');record('Supabase Auth old-token update rejected separately','Passed',authUpdate.status());
 if(Date.now()<signedAt+11000)await new Promise(r=>setTimeout(r,signedAt+11000-Date.now()));const expired=await a.ctx.request.get(signedURL);check(expired.status()>=400,'expired-signed-url');record('short preexisting signed URL unusable after expiry/deletion; downloaded bytes are outside revocation','Passed',expired.status());
 const afterB=await (await call(b,'/api/platform')).json();check(afterB.user.id===fixture.credentials.b.id&&afterB.activity.every(x=>x.user_id===fixture.credentials.b.id),'control-still-isolated');check((await call(b,'/api/media?id='+fixture.ids.assetB)).status()===200,'control-media-after');check((await call(b,'/api/account/export',{})).status()===200,'control-export-after');check(edge('state').result.studentBChecksum===controlState.studentBChecksum,'control-checksum-after');record('control B data checksum, protected media, notes and export unchanged');
 fs.writeFileSync('docs/evidence/F00.5-LIVE-RESULTS.json',JSON.stringify({commit:control.commit,deploymentId:control.deploymentId,browser:browser.version(),transport:'real Auth + protected Next Preview + Storage + PostgreSQL; worker boundary failures injected',results:evidence},null,2));
 console.log('PASS real protected Preview security workflow');
}catch(e){fs.mkdirSync('docs/evidence',{recursive:true});fs.writeFileSync(path.join(dir,'failure.json'),JSON.stringify({stage,completedCases:evidence}));console.error('FAIL live protected Preview at '+stage+'; detailed request diagnostics suppressed');process.exitCode=1;}
finally{for(const c of contexts)await c.close();await browser?.close();}
