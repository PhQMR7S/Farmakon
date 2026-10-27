// Local production build with controlled API fixtures; no provider performance claim.
import {chromium} from '@playwright/test';import AxeBuilder from '@axe-core/playwright';import fs from 'node:fs';import {performance} from 'node:perf_hooks';import {spawn} from 'node:child_process';import {fixture,transport,navigate} from './ui-fixture.mjs';
const phase=process.argv[2]||'after',origin='http://127.0.0.1:3107',output=process.argv[3]||`/tmp/f007-browser-${phase}.json`;
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3107'],{env:{...process.env,DATABASE_URL:'',NEXT_PUBLIC_SUPABASE_URL:'',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:''},stdio:'ignore'});
let browser;const results=[];
try{
 for(let i=0;i<100;i++){try{if((await fetch(origin+'/login')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({executablePath:process.env.FARMAKON_TEST_CHROMIUM,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 for(const width of phase==='before'?[390,1280]:[360,390,768,1280]){
  const ctx=await browser.newContext({viewport:{width,height:900},colorScheme:'light'}),page=await ctx.newPage(),errors=[];page.on('pageerror',()=>errors.push('pageerror'));page.on('console',m=>{if(['error','warning'].includes(m.type()))errors.push('console-'+m.type());});
  await transport(page);
  const start=performance.now();await page.goto(origin+'/login');await page.getByRole('heading',{name:'تسجيل الدخول',exact:true}).waitFor();
  const nav=await page.evaluate(()=>{const n=performance.getEntriesByType('navigation')[0];return {duration:n.duration,transferSize:n.transferSize,domContentLoaded:n.domContentLoadedEventEnd};});
  const audit=async flow=>{const a=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();results.push({width,flow,auditCumulativeElapsedMs:performance.now()-start,navigation:nav,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),consoleErrors:errors.length,violations:a.violations.map(v=>({id:v.id,impact:v.impact,count:v.nodes.length,targets:v.nodes.map(n=>n.target)}))});};
  await audit('login');await page.goto(origin);await page.getByRole('heading',{name:'خطوتك القادمة في الصيدلة',exact:true}).waitFor();await audit('dashboard');
  await navigate(page,'الكورسات');await audit('courses');await navigate(page,'المكتبة العلمية');await audit('library');await navigate(page,'بنك الأسئلة');await audit('questions');
  await navigate(page,'الاختبارات');await page.getByRole('button',{name:'ابدأ الاختبار',exact:true}).click();await page.getByRole('timer').waitFor();await audit('exam');
  if(phase==='after'){
   await page.screenshot({path:`/tmp/f007-exam-${width}.png`,fullPage:false});
   await page.evaluate(()=>document.documentElement.dataset.theme='dark');await audit('exam-dark');
  }
  await ctx.close();
 }
 fs.writeFileSync(output,JSON.stringify({phase,scope:'local production Next build; HTTP/Auth/Storage transport fixtures; axe automated subset',results},null,2));console.log(JSON.stringify({phase,scans:results.length,violations:results.map(r=>({width:r.width,flow:r.flow,ids:r.violations.map(v=>v.id)}))}));
}finally{await browser?.close();server.kill('SIGTERM');}
