import {test,expect} from '@playwright/test';
// Browser plugin not available. Local Playwright tests use no live Auth/DB credentials.
// Transport fixtures prove UI behavior, not email delivery or real Supabase sign-in.
test('Arabic login/signup/recovery and form validation',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/login');await expect(page).toHaveTitle(/Farmakon/);
 await expect(page.locator('html')).toHaveAttribute('dir','rtl');
 await expect(page.getByRole('heading',{name:'تسجيل الدخول'})).toBeVisible();
 await page.getByRole('button',{name:'إنشاء حساب جديد',exact:true}).click();
 await expect(page.getByLabel('الاسم الكامل')).toBeVisible();
 await expect(page.getByLabel(/^كلمة المرور/)).toHaveAttribute('minlength','10');
 await page.route('**/api/auth',async route=>{
  const body=route.request().postDataJSON();expect(body.action).toBe('signup');
  await route.fulfill({json:{ok:true,message:'راجع بريدك لتأكيد الحساب.'}});
 });
 await page.getByLabel('الاسم الكامل').fill('طالب اختبار');
 await page.getByLabel('البريد الإلكتروني').fill('student@example.test');
 await page.getByLabel(/^كلمة المرور/).fill('test-only-password');
 await page.getByRole('button',{name:'إنشاء الحساب',exact:true}).click();
 await expect(page.getByRole('status')).toHaveText('راجع بريدك لتأكيد الحساب.');
 await page.getByRole('button',{name:'نسيت كلمة المرور؟'}).click();
 await expect(page.getByRole('heading',{name:'استعادة كلمة المرور'})).toBeVisible();
 await expect(page.getByLabel(/^كلمة المرور/)).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(errors).toEqual([]);
});
test('password mismatch never calls reset API',async({page})=>{
 let requests=0;page.on('request',r=>{if(r.url().endsWith('/api/auth'))requests++});
 await page.goto('/reset-password');await page.getByLabel('كلمة المرور الجديدة').fill('first-test-password');
 await page.getByLabel('تأكيد كلمة المرور').fill('other-test-password');
 await page.getByRole('button',{name:'حفظ كلمة المرور'}).click();
 await expect(page.getByRole('status')).toHaveText('كلمتا المرور غير متطابقتين');expect(requests).toBe(0);
});
test('API rejects cross-origin mutation',async({request})=>{
 const r=await request.post('/api/auth',{headers:{origin:'https://evil.example.test'},data:{action:'logout'}});
 expect(r.status()).toBe(403);
});
