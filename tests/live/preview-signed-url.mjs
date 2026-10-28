// Optional real signed-grant lifetime probe, using only the disposable B fixture.
import fs from 'node:fs';import path from 'node:path';
import {chromium} from '@playwright/test';import {createServerClient} from '@supabase/ssr';
const file=process.argv[2];if(!file?.startsWith('/tmp/farmakon-f005-'))throw Error('Private control required');
const c=JSON.parse(fs.readFileSync(file,'utf8')),f=JSON.parse(fs.readFileSync(path.join(path.dirname(file),'fixtures.json'),'utf8'));
if(c.target!=='staging'||f.projectRef!=='qfzharpouemueipsrduv')throw Error('Isolated target required');
let browser,stage='launch';const check=(v)=>{if(!v)throw Error('probe-failed')};
try{
 browser=await chromium.launch({executablePath:process.env.FARMAKON_TEST_CHROMIUM||'/tmp/f005-browser/runtime/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'],...(process.env.HTTPS_PROXY?{proxy:{server:new URL(process.env.HTTPS_PROXY).origin}}:{})});
 const ctx=await browser.newContext({baseURL:c.preview});const u=new URL('/api/health',c.preview);u.searchParams.set('_vercel_share',c.share);const grant=await ctx.request.get(u.href,{maxRedirects:0});const loc=grant.headers().location;check(!loc||new URL(loc,c.preview).origin===c.preview);
 const page=await ctx.newPage();async function login(){await page.goto('/login');await page.getByLabel('البريد الإلكتروني').fill(f.credentials.b.email);await page.getByLabel(/^كلمة المرور/).fill(f.credentials.b.password);const r=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/auth'&&r.request().method()==='POST');await page.getByRole('button',{name:'دخول',exact:true}).click();check((await r).status()===200);await page.waitForURL(u=>u.pathname==='/');}
 stage='login';await login();const cookies=await ctx.cookies(c.preview);const sdk=createServerClient('https://qfzharpouemueipsrduv.supabase.co',c.publicKey,{cookies:{getAll:()=>cookies,setAll(){}}});const token=(await sdk.auth.getSession()).data.session?.access_token;check(token);
 const headers={apikey:c.publicKey,Authorization:'Bearer '+token};const api='https://qfzharpouemueipsrduv.supabase.co';
 stage='private-jobs';const privateJobs=await ctx.request.get(api+'/rest/v1/deletion_jobs?select=state&limit=1',{headers:{...headers,'Accept-Profile':'farmakon'}});check(privateJobs.status()>=400);
 stage='mint';const minted=await ctx.request.post(api+'/storage/v1/object/sign/farmakon/'+f.ids.assetB,{headers,data:{expiresIn:60}});check(minted.status()===200);const signed=api+'/storage/v1'+(await minted.json()).signedURL;const issued=Date.now();check((await ctx.request.get(signed)).status()===200);
 stage='logout';check((await ctx.request.post(api+'/auth/v1/logout?scope=local',{headers})).status()===204);
 const nextDenied=await ctx.request.get(c.preview+'/api/platform');check(nextDenied.status()===401);
 const directDenied=await ctx.request.get(api+'/storage/v1/object/farmakon/'+f.ids.assetB+'?cacheNonce='+Date.now(),{headers:{...headers,'Cache-Control':'no-cache'}});check(directDenied.status()>=400);
 stage='existing-grant';const stillSigned=await ctx.request.get(signed);check(stillSigned.status()===200);console.log('PASS signed URL remains a usable independent grant after real session revocation while Next and fresh Storage requests are denied');
 while(Date.now()<issued+62000)await new Promise(r=>setTimeout(r,Math.min(30000,issued+62000-Date.now())));
 stage='expired-grant';const expired=await ctx.request.get(signed);check(expired.status()>=400);
 stage='control-relogin';await login();check((await ctx.request.get(c.preview+'/api/platform')).status()===200);check((await ctx.request.get(c.preview+'/api/media?id='+f.ids.assetB)).status()===200);
 fs.writeFileSync('docs/evidence/F00.5-SIGNED-GRANT-RESULTS.json',JSON.stringify({deploymentId:c.deploymentId,commit:c.commit,ttlSeconds:60,privateDeletionJobsStatus:privateJobs.status(),nextAfterRevocation:nextDenied.status(),directStorageAfterRevocation:directDenied.status(),signedURLAfterRevocation:stillSigned.status(),signedURLAfterExpiry:expired.status(),controlBRelogin:true,limitation:'Already received bytes and independent caches cannot be revoked by deleting a session.'},null,2));console.log('PASS old signed grant rejected after measured TTL interval; B can sign in and read its unchanged file again');
}catch{console.error('FAIL signed grant probe at '+stage+'; sensitive URL diagnostics suppressed');process.exitCode=1;}finally{await browser?.close();}
