import {test,expect} from '@playwright/test';

// Actual Arabic UI; controlled HTTP transport and server clock, not live Auth/DB.
test('exam resumes a fixed deadline, acknowledges saves, tolerates disconnect and shows a settled result',async({page,context})=>{
 const server=Date.now();let active:any=null,done:any=null,failSave=false;
 const question={id:'q',title:'سؤال اصطناعي',options:['أول','ثان','ثالث','رابع']};
 await page.route('**/api/platform',async route=>{
  const req=route.request();
  if(req.method()==='GET')return route.fulfill({json:{serverNow:server,user:{id:'exam-student',name:'طالب اصطناعي',admin:false},course:[],lesson:[],file:[],question:[],announcement:[],exam:[{id:'exam',title:'اختبار اصطناعي',minutes:1,questionIds:['q']}],attempts:active?[active]:[],completedAttempts:done?[{id:'attempt',examId:'exam',result:done}]:[],enrollments:[],activity:[],settings:{offlineHours:48}}});
  const b=req.postDataJSON();
  if(b.action==='startExam'){active??={id:'attempt',examId:'exam',title:'اختبار اصطناعي',startedAt:server,deadline:server+60000,serverNow:server,questions:[question],answers:{},status:'active'};return route.fulfill({json:active});}
  if(b.action==='saveExam'){
   if(failSave)return route.fulfill({status:503,json:{error:'تعذر الحفظ'}});
   expect(Object.keys(b.answers)).toEqual(['q']);active.answers={...active.answers,...b.answers};return route.fulfill({json:{ok:true,answers:active.answers,serverNow:server,deadline:active.deadline}});
  }
  if(b.action==='submitExam'){expect(b.answers).toEqual({});done={score:1,total:1,expired:true,questions:[{...question,selected:1,correct:1,explanation:'تفسير اصطناعي'}]};active=null;return route.fulfill({json:done});}
  return route.fulfill({status:400,json:{error:'Unexpected test action'}});
 });
 await page.goto('/');
 const navigate=async()=>{if((page.viewportSize()?.width||1000)<760)await page.getByRole('button',{name:'القائمة',exact:true}).click();const nav=page.locator('.sidebar');await nav.getByRole('button',{name:'الاختبارات',exact:true}).click();};
 await navigate();await page.getByRole('button',{name:'ابدأ الاختبار',exact:true}).click();
 await expect(page.getByRole('timer')).toContainText('0:');
 // Changing wall clock cannot extend or terminate monotonic server-based timer.
 await page.evaluate(()=>{Date.now=()=>1;});
 const option=page.getByRole('button',{name:'B ثان',exact:true});await option.focus();await page.keyboard.press('Enter');
 await expect(page.getByRole('status').filter({hasText:/^محفوظ$/})).toBeVisible();
 failSave=true;await page.getByRole('button',{name:'A أول',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'تعذر الحفظ'})).toBeVisible();
 await context.setOffline(true);await expect(page.getByRole('status').filter({hasText:'انقطع الاتصال'})).toBeVisible();await expect(option).toBeDisabled();
 await context.setOffline(false);failSave=false;
 const originalDeadline=active.deadline;await page.reload();await navigate();await page.getByRole('button',{name:'استكمال الاختبار',exact:true}).click();expect(active.deadline).toBe(originalDeadline);
 await expect(page.getByRole('button',{name:'B ثان',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'تسليم الإجابات',exact:true}).click();await expect(page.getByRole('heading',{name:'نتيجتك: 1 / 1'})).toBeVisible();
 await page.reload();await navigate();await page.getByRole('button',{name:'عرض آخر نتيجة',exact:true}).click();await expect(page.getByRole('heading',{name:'نتيجتك: 1 / 1'})).toBeVisible();
 expect(await page.locator('html').getAttribute('dir')).toBe('rtl');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
