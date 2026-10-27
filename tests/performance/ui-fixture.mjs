export const fixture=()=>({serverNow:Date.now(),user:{id:'f007-student',name:'طالب اصطناعي',email:'f007@example.test',admin:false},course:[{id:'c',title:'علم الأدوية الاصطناعي',description:'محتوى اختبار الأداء والوصولية',stage:'المرحلة الثالثة',category:'علم الأدوية',price:0,days:365,status:'published',color:'blue'}],lesson:[{id:'l',courseId:'c',title:'محاضرة اصطناعية',module:'الوحدة الأولى',order:1,minutes:30,url:'',free:false,status:'published'}],file:[{id:'f',courseId:'c',title:'ملخص اصطناعي',category:'ملخص',stage:'المرحلة الثالثة',subject:'علم الأدوية',year:'2026',description:'ملف اختبار',url:'/api/media?id=pdf',download:true,status:'published'}],question:[{id:'q',courseId:'c',title:'سؤال اصطناعي',options:['أول','ثان','ثالث','رابع'],stage:'المرحلة الثالثة',subject:'علم الأدوية',questionType:'تدريبي',topic:'عام'}],exam:[{id:'e',courseId:'c',title:'اختبار اصطناعي',minutes:1,questionIds:['q'],status:'published'}],announcement:[],attempts:[],completedAttempts:[],enrollments:[{id:'en',email:'f007@example.test',course_id:'c',expires:Date.now()+86400000}],activity:[{kind:'progress',target:'l',data:{seconds:10,note:'ملاحظة اصطناعية',completed:false}}],orders:[],tickets:[],settings:{name:'Farmakon',offlineHours:48},members:[],codes:[],audit:[]});
export async function transport(page,{delay=0,admin=false}={}){
 const state=fixture();state.user.admin=admin;
 await page.route('**/api/platform',async route=>{
  if(delay)await new Promise(r=>setTimeout(r,delay));
  if(route.request().method()==='GET')return route.fulfill({json:{...state,serverNow:Date.now()}});
  const b=route.request().postDataJSON();
  if(b.action==='startExam')return route.fulfill({json:{id:'at',examId:'e',title:'اختبار اصطناعي',deadline:Date.now()+60000,serverNow:Date.now(),answers:{},questions:state.question,status:'active'}});
  if(b.action==='saveExam')return route.fulfill({json:{ok:true,serverNow:Date.now()}});
  if(b.action==='submitExam')return route.fulfill({json:{score:1,total:1,questions:[{...state.question[0],selected:1,correct:1,explanation:'شرح اصطناعي'}]}});
  return route.fulfill({json:{ok:true}});
 });
}
export async function navigate(page,label){if((page.viewportSize()?.width||1000)<=760){await page.getByRole('button',{name:'القائمة',exact:true}).click();}await page.locator('.sidebar').getByRole('button',{name:label,exact:true}).click();if((page.viewportSize()?.width||1000)<=760)await page.waitForFunction(()=>!document.getElementById('main-content')||document.activeElement?.id==='main-content');}
