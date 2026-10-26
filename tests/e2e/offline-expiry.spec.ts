import {test,expect,Page} from '@playwright/test';
const instant=new Date('2026-10-26T12:00:00Z');
async function seed(page:Page,until:string){await page.evaluate(async(expiry:string)=>{await(await caches.open('farmakon-downloads-v1')).put('/api/media?id=expiry-fixture',new Response('synthetic file',{headers:{'Content-Type':'application/pdf','x-offline-title':'Expiry fixture','x-offline-until':expiry}}));},until);}
async function account(page:Page){
 await page.clock.install({time:instant});
 await page.route('**/api/platform',route=>route.fulfill({json:{user:{id:'offline-student',name:'طالب اختبار',email:'student@example.test',admin:false},needsSetup:false,course:[],lesson:[],file:[],question:[],exam:[],announcement:[],attempts:[],enrollments:[],activity:[],orders:[],tickets:[],settings:{offlineHours:48}}}));
 await page.goto('/');
}
async function downloads(page:Page){const nav=page.locator((page.viewportSize()?.width||1000)<760?'.mobile-dock':'.sidebar');if((page.viewportSize()?.width||1000)<760){await page.getByRole('button',{name:'القائمة',exact:true}).click();await page.locator('.sidebar').getByRole('button',{name:'التنزيلات',exact:true}).click();}else await nav.getByRole('button',{name:'التنزيلات',exact:true}).click();}
test('app refuses a cached download that expires after listing',async({page})=>{
 await account(page);await seed(page,String(instant.getTime()+60000));await downloads(page);
 await expect(page.getByRole('heading',{name:'Expiry fixture'})).toBeVisible();
 let opened=0;page.on('popup',()=>opened++);await page.clock.fastForward(60000);
 await page.getByRole('button',{name:'فتح',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('انتهت صلاحية الملف');expect(opened).toBe(0);
 await expect.poll(()=>page.evaluate(async()=>!!await(await caches.open('farmakon-downloads-v1')).match('/api/media?id=expiry-fixture'))).toBe(false);
});
for(const expiry of ['NaN','Infinity','',String(instant.getTime())])test(`app removes invalid or expired metadata: ${expiry}`,async({page})=>{
 await account(page);await seed(page,expiry);await downloads(page);await expect(page.getByRole('heading',{name:'Expiry fixture'})).toHaveCount(0);
 await expect.poll(()=>page.evaluate(async()=>!!await(await caches.open('farmakon-downloads-v1')).match('/api/media?id=expiry-fixture'))).toBe(false);
});
test('offline page re-reads cache when expiry changes after listing',async({page})=>{
 await account(page);await seed(page,String(instant.getTime()+60000));await page.goto('/offline.html');
 const button=page.getByRole('button',{name:'Expiry fixture'});await expect(button).toBeVisible();
 await seed(page,'NaN');await button.click();await expect(page.locator('#list')).toContainText('انتهت صلاحية الملف');
});

test('a valid unexpired cached file still opens',async({page})=>{
 await account(page);await seed(page,String(instant.getTime()+60000));await downloads(page);
 await page.evaluate(()=>{window.open=(url)=>{(window as any).__openedOffline=String(url);return null;};});
 await page.getByRole('button',{name:'فتح',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).__openedOffline)).toMatch(/^blob:/);
 expect(await page.evaluate(async()=>!!await(await caches.open('farmakon-downloads-v1')).match('/api/media?id=expiry-fixture'))).toBe(true);
});
