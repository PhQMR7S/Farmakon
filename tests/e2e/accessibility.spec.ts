import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {transport,navigate} from '../performance/ui-fixture.mjs';

for(const width of [360,390,768,1280])test(`targeted WCAG scans, reflow and keyboard navigation at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await transport(page);
 await page.goto('/login');await expect(page.getByRole('heading',{name:'تسجيل الدخول',exact:true})).toBeVisible();
 const audit=async()=>{const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();expect(result.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);};
 await audit();await page.getByLabel('البريد الإلكتروني').focus();await page.keyboard.press('Tab');await expect(page.getByLabel(/^كلمة المرور/)).toBeFocused();
 await page.goto('/');await expect(page.getByRole('heading',{name:'خطوتك القادمة في الصيدلة',exact:true})).toBeVisible();
 await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'تخطي إلى المحتوى',exact:true})).toBeFocused();await page.keyboard.press('Enter');await expect(page.locator('#main-content')).toBeFocused();
 if(width<=760){
  await expect(page.locator('#primary-navigation')).toHaveAttribute('inert','');
  const menu=page.getByRole('button',{name:'القائمة',exact:true});await menu.focus();await page.keyboard.press('Enter');await expect(menu).toHaveAttribute('aria-expanded','true');
  await expect(page.locator('#primary-navigation a.brand')).toBeFocused();await page.keyboard.press('Shift+Tab');await expect(page.locator('#primary-navigation a').last()).toBeFocused();await page.keyboard.press('Escape');await expect(menu).toBeFocused();
 }
 await audit();await navigate(page,'المكتبة العلمية');await audit();
 await navigate(page,'الاختبارات');await page.getByRole('button',{name:'ابدأ الاختبار',exact:true}).click();await expect(page.getByRole('timer')).toHaveAttribute('aria-live','off');await audit();
 await page.getByRole('button',{name:'B ثان',exact:true}).focus();await page.keyboard.press('Enter');await expect(page.getByText('محفوظ',{exact:true})).toBeVisible();
 await page.evaluate(()=>document.documentElement.dataset.theme='dark');await audit();
 // 200% text enlargement, not a claim of actual assistive technology testing.
 await page.addStyleTag({content:'body{font-size:200%}button,input,select,textarea{font-size:1em!important}'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('slow API, failed refresh and failed answer save remain recoverable',async({page,context})=>{
 await transport(page,{delay:400});await page.goto('/');await expect(page.getByRole('heading',{name:'خطوتك القادمة في الصيدلة',exact:true})).toBeVisible();
 await navigate(page,'الاختبارات');await page.getByRole('button',{name:'ابدأ الاختبار',exact:true}).click();
 await page.route('**/api/platform',async route=>{
  await new Promise(r=>setTimeout(r,300));return route.fulfill({status:503,json:{error:'الخدمة غير متاحة مؤقتاً'}});
 });
 await page.getByRole('button',{name:'B ثان',exact:true}).click();await expect(page.getByText(/^تعذر الحفظ؛/)).toBeVisible();await expect(page.getByRole('button',{name:'B ثان',exact:true})).toBeEnabled();
 await context.setOffline(true);await expect(page.getByText('انقطع الاتصال؛ لن تُحفظ إجابات جديدة حتى عودته. الموعد لا يتغير.',{exact:true})).toBeVisible();await context.setOffline(false);
 await expect(page.getByRole('alert').filter({hasText:'قد تكون المعلومات المعروضة قديمة'})).toBeVisible();
 await expect(page.getByRole('button',{name:'إعادة المحاولة',exact:true})).toBeEnabled();
});
