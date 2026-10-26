import {test,expect,Page} from '@playwright/test';
import fs from 'node:fs/promises';

// UI transport fixture only. Backend/Postgres tests verify export authorization.
async function account(page:Page){
 await page.route('**/api/platform',route=>route.fulfill({json:{
  user:{id:'student-fixture',name:'طالب اختبار',email:'student@example.test',admin:false},needsSetup:false,
  course:[],lesson:[],file:[],question:[],exam:[],announcement:[],attempts:[],enrollments:[],activity:[],orders:[],tickets:[],settings:{offlineHours:48}
 }}));
 await page.goto('/');
 const nav=page.locator((page.viewportSize()?.width||1000)<760?'.mobile-dock':'.sidebar');
 await nav.getByRole('button',{name:'حسابي',exact:true}).click();
 await expect(page.getByRole('heading',{name:'بيانات حسابك'})).toBeVisible();
}
test('download study data as a private JSON attachment',async({page})=>{
 await account(page);
 const payload={format:'farmakon-study-data',version:1,profile:{email:'student@example.test'},activity:[{data:{note:'ملاحظة اصطناعية'}}]};
 await page.route('**/api/account/export',async route=>{
  expect(route.request().method()).toBe('POST');expect(route.request().postDataJSON()).toEqual({});
  await route.fulfill({json:payload,headers:{'Cache-Control':'private, no-store'}});
 });
 const downloaded=page.waitForEvent('download');
 await page.getByRole('button',{name:'تنزيل بياناتي الدراسية'}).click();
 const file=await downloaded;expect(file.suggestedFilename()).toBe('farmakon-study-data.json');
 expect(JSON.parse(await fs.readFile((await file.path())!,'utf8'))).toEqual(payload);
 await expect(page.getByRole('status')).toContainText('تم تنزيل بياناتك الدراسية');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('export refusal stays visible and permits a later retry',async({page})=>{
 await account(page);let calls=0;
 await page.route('**/api/account/export',route=>{calls++;return route.fulfill({status:429,json:{error:'طلبات كثيرة. انتظر قليلًا ثم أعد المحاولة.'}})});
 const button=page.getByRole('button',{name:'تنزيل بياناتي الدراسية'});await button.click();
 await expect(page.getByRole('status')).toContainText('طلبات كثيرة');await expect(button).toBeEnabled();expect(calls).toBe(1);
});
