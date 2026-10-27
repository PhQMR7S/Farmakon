// Isolated loopback UI only. Dummy pinned config passes the Staging gate;
// API calls are intercepted before transport; no Auth/DB/Storage service used.
import {chromium,devices} from '@playwright/test';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const origin='http://127.0.0.1:3102';
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3102'],{detached:true,stdio:'ignore',env:{...process.env,VERCEL_ENV:'preview',FARMAKON_SYNTHETIC_DELETION_ENABLED:'true',NEXT_PUBLIC_SUPABASE_URL:'https://qfzharpouemueipsrduv.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'fixture-no-provider-access',DATABASE_URL:'postgresql://fixture:fixture@db.qfzharpouemueipsrduv.supabase.co/postgres',FARMAKON_STRICT_SESSIONS_ENABLED:'true',FARMAKON_RATE_LIMIT_ENABLED:'true',FARMAKON_RATE_LIMIT_SECRET:'synthetic-ui-only-no-real-secret-00000000'}});
let browser;
try{
 let ready=false;for(let i=0;i<120;i++){try{if((await fetch(origin+'/account/delete')).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,250));}
 assert.equal(ready,true,'Loopback UI server did not become ready');
 browser=await chromium.launch({headless:true});
 for(const device of [devices['Desktop Chrome'],devices['Pixel 7']]){
  const context=await browser.newContext({...device,baseURL:origin});const page=await context.newPage();let requests=0;
  await context.route('**/api/account/delete',async route=>{if(route.request().method()==='GET'){await route.fulfill({json:{eligible:true}});return}requests++;const b=route.request().postDataJSON();assert.deepEqual(Object.keys(b).sort(),['confirmation','password']);assert.equal(b.confirmation,'DELETE SYNTHETIC ACCOUNT');await route.fulfill({status:requests===1?503:202,json:requests===1?{error:'تعذر قبول الطلب'}:{accepted:true,message:'تم قبول طلب الاختبار'}})});
  await page.goto('/account/delete');
  await page.evaluate(async()=>{await caches.open('farmakon-downloads-v1');await caches.open('unrelated-cache')});
  await page.getByRole('button',{name:'تأكيد حذف حساب الاختبار'}).click();assert.equal(requests,0);
  await page.getByLabel('كلمة المرور الحالية').fill('fixture-only-password');
  await page.getByLabel('للتأكيد اكتب DELETE SYNTHETIC ACCOUNT').fill('WRONG');
  await page.getByRole('button',{name:'تأكيد حذف حساب الاختبار'}).click();assert.equal(requests,0);
  await page.getByLabel('للتأكيد اكتب DELETE SYNTHETIC ACCOUNT').fill('DELETE SYNTHETIC ACCOUNT');
  await page.getByRole('button',{name:'تأكيد حذف حساب الاختبار'}).click();
  await page.getByRole('status').filter({hasText:'تعذر قبول الطلب'}).waitFor();
  await page.getByRole('button',{name:'تأكيد حذف حساب الاختبار'}).click();
  await page.getByRole('status').filter({hasText:'تم قبول طلب الاختبار'}).waitFor();
  for(let i=0;i<20;i++){if(!(await page.evaluate(()=>caches.keys())).includes('farmakon-downloads-v1'))break;await page.waitForTimeout(50)}
  const names=await page.evaluate(()=>caches.keys());assert.ok(!names.some(n=>n.startsWith('farmakon-')));assert.ok(names.includes('unrelated-cache'));
  assert.equal(await page.getByRole('button',{name:'تأكيد حذف حساب الاختبار'}).isDisabled(),true);
  assert.equal(await page.getByLabel('كلمة المرور الحالية').inputValue(),'');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await context.close();
 }
 console.log('PASS: actual synthetic deletion form on desktop and Pixel 7 RTL; required/password/phrase checks, failure retry, acceptance state and scoped browser-cache cleanup. API transport fixture; no real account deleted.');
}finally{await browser?.close();try{process.kill(-server.pid,'SIGTERM')}catch{}}
