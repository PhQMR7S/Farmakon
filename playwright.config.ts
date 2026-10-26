import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e',fullyParallel:true,retries:0,reporter:'list',
 use:{baseURL:'http://127.0.0.1:3100',trace:'off',screenshot:'only-on-failure',
  launchOptions:process.env.FARMAKON_TEST_CHROMIUM?{executablePath:process.env.FARMAKON_TEST_CHROMIUM,args:['--no-sandbox','--disable-dev-shm-usage']}:{}},
 projects:[{name:'desktop',use:{...devices['Desktop Chrome']}},{name:'android-rtl',use:{...devices['Pixel 7'],defaultBrowserType:'chromium'}}],
 webServer:{command:'npm run start -- --hostname 127.0.0.1 --port 3100',url:'http://127.0.0.1:3100/login',reuseExistingServer:false,timeout:60000,
  env:{NEXT_PUBLIC_SUPABASE_URL:'',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'',DATABASE_URL:''}},
});
