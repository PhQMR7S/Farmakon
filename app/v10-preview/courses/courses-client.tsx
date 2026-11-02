'use client';
import {useEffect,useState} from 'react';
import {ArrowRight,BookOpen,ChevronLeft,ClipboardList,GraduationCap,House,Library,LifeBuoy,PanelRightClose,ShieldCheck,Sparkles,Wallet,X} from 'lucide-react';
import CoursesHub from '../../components/courses-hub';
import {FarmakonHeader,MobileNavigation,ShellLayers,type ShellPanel,type SearchResult} from '../../components/v10-shell';
import type {CourseRecord} from '../../components/courses-logic';
type Section='courses'|'dashboard'|'learning'|'library'|'questions'|'exams'|'account'|'subscriptions'|'downloads'|'support';
const now=Date.now();
const courses:CourseRecord[]=[
 {id:'course-practice',title:'التدريب الصيفي في الصيدلة',description:'مهارات الصيدلية العملية، التعامل مع الأدوية ووصفات المرضى، وتنظيم التجربة التدريبية.',stage:'المرحلة الرابعة',category:'التدريب الصيفي',price:50000,color:'blue',status:'published',days:180,updated:1762000000000},
 {id:'course-pharma',title:'Pharmacology | علم الأدوية',description:'فهم آليات عمل الأدوية، التأثيرات الدوائية والتطبيقات السريرية بصورة منظمة.',stage:'المرحلة الثالثة',category:'علم الأدوية',price:40000,color:'purple',status:'published',days:180,updated:1762000000001},
 {id:'course-therapy',title:'Therapeutics II',description:'التطبيقات العلاجية والحالات السريرية والمراجعات المرتبطة بالمقرر.',stage:'المرحلة الخامسة',category:'العلاجيات',price:65000,color:'teal',status:'published',days:365,updated:1762000000002},
 {id:'course-chem',title:'Pharmaceutical Chemistry',description:'كيمياء الأدوية والمجموعات الوظيفية ومراجعة الصيغ والتفاعلات الأساسية.',stage:'المرحلة الثانية',category:'الكيمياء الصيدلانية',price:30000,color:'amber',status:'published',days:120,updated:1762000000003},
 {id:'course-clinical',title:'Clinical Pharmacy Essentials',description:'مدخل إلى الصيدلة السريرية والتفكير في استخدام الأدوية بصورة آمنة.',stage:'المرحلة الرابعة',category:'الصيدلة السريرية',price:0,color:'teal',status:'published',days:0,updated:1762000000004},
 {id:'course-biology',title:'أساسيات الأحياء المجهرية',description:'أساسيات الأحياء المجهرية الصيدلانية والآليات العلاجية.',stage:'المرحلة الأولى',category:'الأحياء المجهرية',price:35000,color:'blue',status:'published',days:90,updated:1762000000005}
];
const lessons:CourseRecord[]=[
 ...['مقدمة في التدريب الصيفي','أساسيات صرف الأدوية','التعامل مع الوصفات','مراجعة مهارات الصيدلية'].map((title,i)=>({id:'practice-'+i,courseId:'course-practice',title,status:'published',minutes:32+i*7,order:i+1})),
 ...['مقدمة في علم الأدوية','Pharmacokinetics','Pharmacodynamics'].map((title,i)=>({id:'pharma-'+i,courseId:'course-pharma',title,status:'published',minutes:40+i*8,order:i+1})),
 ...['Therapy — Basics','Therapy — Cases'].map((title,i)=>({id:'therapy-'+i,courseId:'course-therapy',title,status:'published',minutes:45+i*10,order:i+1})),
 ...['Chemistry 01','Chemistry 02'].map((title,i)=>({id:'chem-'+i,courseId:'course-chem',title,status:'published',minutes:38+i*9,order:i+1})),
 {id:'clinical-1',courseId:'course-clinical',title:'Introduction to Clinical Pharmacy',status:'published',minutes:35,order:1},
 {id:'biology-1',courseId:'course-biology',title:'Microbiology Introduction',status:'published',minutes:30,order:1}
];
const enrollments:CourseRecord[]=[
 {course_id:'course-practice',expires:Date.parse('2027-04-10T00:00:00Z')},
 {course_id:'course-pharma',expires:Date.parse('2027-06-30T00:00:00Z')},
 {course_id:'course-therapy',expires:Date.parse('2025-09-30T00:00:00Z')}
];
const activity:CourseRecord[]=[
 {kind:'progress',target:'practice-0',data:{seconds:1200,completed:true},updated:1762000005000},
 {kind:'progress',target:'practice-1',data:{seconds:840,completed:true},updated:1762000010000},
 {kind:'progress',target:'practice-2',data:{seconds:640,completed:false},updated:1762000050000},
 {kind:'progress',target:'pharma-0',data:{seconds:900,completed:true},updated:1762000000000}
];
const sections=[
 {id:'dashboard' as Section,label:'الرئيسية',icon:House},
 {id:'learning' as Section,label:'التعلّم',icon:GraduationCap},
 {id:'courses' as Section,label:'كورساتي',icon:BookOpen},
 {id:'library' as Section,label:'المكتبة العلمية',icon:Library},
 {id:'questions' as Section,label:'بنك الأسئلة',icon:ClipboardList},
 {id:'account' as Section,label:'حسابي',icon:ShieldCheck},
 {id:'subscriptions' as Section,label:'اشتراكاتي',icon:Wallet},
 {id:'support' as Section,label:'الدعم والمساعدة',icon:LifeBuoy}
];
const labels:Record<string,string>={...Object.fromEntries(sections.map(s=>[s.id,s.label])),exams:'الاختبارات',downloads:'التنزيلات'};
const examples:SearchResult[]=courses.map(c=>({id:c.id,title:c.title,kind:'كورس توضيحي',section:'courses',course:c}));
export default function CoursesPreview(){
 const [section,setSection]=useState<Section>('courses');
 const [courseMode,setCourseMode]=useState<'mine'|'explore'>('mine');
 const [selected,setSelected]=useState<CourseRecord|null>(null);
 const [panel,setPanel]=useState<ShellPanel>(null);
 const [menu,setMenu]=useState(false);
 const [collapsed,setCollapsed]=useState(false);
 const [theme,setTheme]=useState<'dark'|'light'>('dark');
 const [notice,setNotice]=useState('');
 useEffect(()=>{document.documentElement.dataset.theme=theme;return()=>document.documentElement.removeAttribute('data-theme')},[theme]);
 useEffect(()=>{if(!menu)return;const saved=document.body.style.overflow;document.body.style.overflow='hidden';const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setMenu(false)};document.addEventListener('keydown',key);return()=>{document.body.style.overflow=saved;document.removeEventListener('keydown',key)}},[menu]);
 function go(id:string,c?:CourseRecord){
   setPanel(null);setMenu(false);setSelected(c||null);
   if(id in labels)setSection(id as Section);
   else setNotice('هذا القسم قيد التطوير.');
   window.scrollTo({top:0,behavior:'smooth'});
 }
 const showCourse=(c:CourseRecord)=>{setSelected(c);setSection('courses');window.scrollTo({top:0,behavior:'smooth'})};
 const showResume=(l:CourseRecord,c:CourseRecord)=>{setNotice('تجربة استكمال الفيديو الفعلية ستكون في صفحة المحاضرة بعد ربط بيانات Staging.');setSelected(c);window.scrollTo({top:0,behavior:'smooth'})};
 return <div dir="rtl" className={'app fk-app fk-demo-app fk-learning-preview '+(collapsed?'fk-compact':'')}>
   <aside className={'sidebar '+(menu?'open ':'')+(collapsed?'is-collapsed':'')} aria-label="قائمة Farmakon التجريبية">
     <button type="button" className="fk-collapse" aria-label="طي القائمة" onClick={()=>setCollapsed(x=>!x)}><PanelRightClose size={19}/></button>
     <a href="/v10-preview/courses" className="brand"><img src="/farmakon-logo.jpg" alt="" width={48} height={48}/><div><b>Farmakon</b><small>أكاديمية الصيدلة</small></div></a>
     <button type="button" className="mobile-close icon-btn" onClick={()=>setMenu(false)} aria-label="إغلاق القائمة"><X size={20}/></button>
     <div className="space-label">مساحة التعلّم</div>
     <nav aria-label="أقسام المنصة">{sections.map(x=>{const Icon=x.icon;return <button type="button" key={x.id} className={'nav-item '+(section===x.id?'selected':'')} aria-current={section===x.id?'page':undefined} onClick={()=>go(x.id)}><Icon size={19}/>{x.label}</button>})}</nav>
     <div className="sidebar-bottom"><div className="mini-card"><Sparkles size={21}/><strong>معاينة V10.3.1</strong><small>بيانات توضيحية، بدون دخول أو اشتراك.</small></div></div>
   </aside>
   {menu&&<div className="shade" role="presentation" onClick={()=>setMenu(false)}/>}
   <div className="workspace">
     <FarmakonHeader title={section==='courses'?selected?'تفاصيل الكورس':courseMode==='mine'?'كورساتي':'استكشف الكورسات':labels[section]||'مركز التعلّم'} menuOpen={menu} onMenu={()=>setMenu(true)} onToggleSidebar={()=>setCollapsed(v=>!v)} onSearch={()=>setPanel('search')} onNotifications={()=>setPanel('notifications')} onMore={()=>setPanel('more')}/>
     <main className="main fk-learning-main">
       {section==='courses'&&!selected&&<CoursesHub onModeChange={setCourseMode} courses={courses} lessons={lessons} enrollments={enrollments} activity={activity} userId="v1031-preview-only" isPreview onOpenCourse={showCourse} onResumeLesson={showResume}/>}
       {section==='courses'&&selected&&<div className="fk-learning-subpage">
         <button type="button" className="fk-learn-back" onClick={()=>setSelected(null)}><ArrowRight size={17}/> العودة إلى الكورسات</button>
         <div className="fk-learning-subpage-card" style={{maxWidth:820,margin:'20px auto'}}>
           <div className="fk-learning-tile-icon"><BookOpen size={35}/></div>
           <span style={{color:'var(--teal)',fontSize:12}}>FARMAKON · COURSE DETAILS</span>
           <h2>{selected.title}</h2>
           <p>{selected.description}</p>
           <p>هذه شاشة تمهيدية لتوضيح انتقال البطاقة. التفاصيل الكاملة والوحدات والاشتراكات ستكون ضمن المرحلة V10.3.2.</p>
           <button type="button" className="fk-learn-primary" onClick={()=>setSelected(null)}>العودة للكورسات <ChevronLeft size={17}/></button>
         </div>
       </div>}
       {section!=='courses'&&<div className="fk-learning-subpage">
         <button type="button" className="fk-learn-back" onClick={()=>go('courses')}><ArrowRight size={17}/> العودة إلى كورساتي</button>
         <div className="fk-learning-subpage-card">
           <div className="fk-learning-tile-icon"><GraduationCap size={35}/></div>
           <h2>{labels[section]}</h2>
           <p>المعاينة الحالية مخصصة لـ«كورساتي» و«استكشف الكورسات» فقط، دون تغيير بقية الأقسام المعتمدة.</p>
           <button type="button" className="fk-learn-primary" onClick={()=>go('courses')}>العودة للكورسات</button>
         </div>
       </div>}
     </main>
   </div>
   <MobileNavigation page={section} panel={panel} adminMode={false} learningAsPage onNavigate={go} onOpen={setPanel}/>
   <ShellLayers panel={panel} onClose={()=>setPanel(null)} onNavigate={go} searchItems={examples} theme={theme} onTheme={()=>setTheme(v=>v==='dark'?'light':'dark')} onInstall={()=>setNotice('التثبيت متاح من الموقع الرسمي بعد اعتماد الإصدار.')} adminMode={false} onSidebar={()=>setMenu(true)} announcements={[]}/>
   {notice&&<div className="fk-demo-toast" role="status"><Sparkles size={18}/><span>{notice}</span><button type="button" aria-label="إغلاق التنبيه" onClick={()=>setNotice('')}><X size={17}/></button></div>}
 </div>;
}
