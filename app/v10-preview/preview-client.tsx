'use client';
import {useEffect,useState,useCallback} from 'react';
import {BookOpen,House,Library,GraduationCap,ClipboardList,Download,Wallet,ShieldCheck,LifeBuoy,Menu,Search,Sun,Moon,ChevronLeft,X,PanelRightClose,FileText,Sparkles,CheckCircle2,Layers,ArrowUpLeft} from 'lucide-react';
import {FarmakonHeader,MobileNavigation,ShellLayers,type ShellPanel,type SearchResult} from '../components/v10-shell';

type Page='dashboard'|'courses'|'library'|'questions'|'exams'|'account'|'subscriptions'|'downloads'|'support';
const links:{id:Page;label:string;icon:typeof House}[]=[
 {id:'dashboard',label:'نظرة عامة',icon:House},
 {id:'courses',label:'كورساتي',icon:BookOpen},
 {id:'library',label:'المكتبة العلمية',icon:Library},
 {id:'questions',label:'بنك الأسئلة',icon:ClipboardList},
 {id:'exams',label:'الاختبارات',icon:GraduationCap},
 {id:'downloads',label:'التنزيلات',icon:Download},
 {id:'subscriptions',label:'اشتراكاتي',icon:Wallet},
 {id:'account',label:'حسابي',icon:ShieldCheck},
 {id:'support',label:'المساعدة والدعم',icon:LifeBuoy},
];
const names=Object.fromEntries(links.map(l=>[l.id,l.label]));
// Clearly marked representative content; intentionally disconnected from auth and DB.
const examples:SearchResult[]=[
 {id:'sample-1',title:'Pharmacology',kind:'كورس توضيحي',section:'courses'},
 {id:'sample-2',title:'Physiology',kind:'كورس توضيحي',section:'courses'},
 {id:'sample-3',title:'ملاحظات محاضرة نموذجية',kind:'ملف توضيحي',section:'library'},
];
export default function PreviewClient(){
 const [page,setPage]=useState<Page>('dashboard'),[menu,setMenu]=useState(false);
 const [panel,setPanel]=useState<ShellPanel>(null),[collapsed,setCollapsed]=useState(false),[theme,setTheme]=useState<'dark'|'light'>('dark');
 const [notice,setNotice]=useState('');
 const go=useCallback((p:string)=>{if(p in names){setPage(p as Page);if(window.location.hash!==('#'+p))window.history.pushState({farmakonPreviewPage:p},'','#'+p)}setMenu(false);setPanel(null);window.scrollTo?.({top:0,behavior:'smooth'})},[]);
 useEffect(()=>{const read=()=>{const p=decodeURIComponent(location.hash.replace(/^#/,''));if(p in names)setPage(p as Page);else setPage('dashboard');setMenu(false);setPanel(null)};read();window.addEventListener('popstate',read);return()=>window.removeEventListener('popstate',read)},[]);
 const show=useCallback((p:ShellPanel)=>{setMenu(false);setPanel(p)},[]);
 const toggleTheme=()=>setTheme(t=>t==='dark'?'light':'dark');
 useEffect(()=>{document.documentElement.dataset.theme=theme;return()=>{delete document.documentElement.dataset.theme}},[theme]);
 useEffect(()=>{if(!menu)return;const old=document.body.style.overflow;document.body.style.overflow='hidden';const prev=document.activeElement as HTMLElement|null;const focus=window.requestAnimationFrame(()=>document.querySelector<HTMLElement>('#demo-sidebar-close')?.focus());
 const key=(ev:KeyboardEvent)=>{if(ev.key==='Escape')setMenu(false);if(ev.key!=='Tab')return;const sidebar=document.querySelector('#demo-sidebar');if(!sidebar)return;const items=Array.from(sidebar.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]')).filter(x=>getComputedStyle(x).visibility!=='hidden');const first=items[0],last=items[items.length-1];if(ev.shiftKey&&document.activeElement===first){ev.preventDefault();last?.focus()}else if(!ev.shiftKey&&document.activeElement===last){ev.preventDefault();first?.focus()}};
 window.addEventListener('keydown',key);return()=>{document.body.style.overflow=old;window.cancelAnimationFrame(focus);window.removeEventListener('keydown',key);prev?.focus()}},[menu]);
 const text=(value:string)=>{setNotice(value);};
 return <div className={'app fk-app fk-demo-app '+(collapsed?'fk-compact':'')} dir="rtl">
  <aside id="demo-sidebar" className={'sidebar '+(menu?'open ':'')+(collapsed?'is-collapsed':'')} aria-label="القائمة الجانبية التجريبية">
   <button className="fk-collapse" type="button" aria-label={collapsed?'توسيع القائمة':'طي القائمة'} onClick={()=>setCollapsed(!collapsed)}><PanelRightClose size={18}/></button>
   <a className="brand" href="/v10-preview" aria-label="Farmakon معاينة التصميم"><img src="/farmakon-logo.jpg" width={50} height={50} alt=""/><div><b>Farmakon</b><small>أكاديمية الصيدلة</small></div></a>
   <button id="demo-sidebar-close" type="button" className="mobile-close icon-btn" onClick={()=>setMenu(false)} aria-label="إغلاق القائمة"><X size={21}/></button>
   <div className="space-label">مساحة التعلّم</div>
   <nav aria-label="القائمة الرئيسية">{links.map(l=>{const Icon=l.icon;return <button key={l.id} type="button" title={l.label} aria-current={page===l.id?'page':undefined} className={page===l.id?'nav-item selected':'nav-item'} onClick={()=>go(l.id)}><Icon size={20}/>{l.label}</button>})}</nav>
   <div className="sidebar-bottom"><div className="mini-card"><ShieldCheck size={23}/><strong>تعلّم بخطوات واضحة</strong><small>محاضرات، مراجعة، ثم اختبار.</small></div>
    <div className="profile"><div className="avatar" aria-hidden="true">F</div><div><b>معاينة تصميم V10.1</b><small>دون حساب أو بيانات شخصية</small></div></div>
   </div>
  </aside>
  {menu&&<div className="shade" role="presentation" onClick={()=>setMenu(false)}/>}
  <div className="workspace">
   <FarmakonHeader title={names[page]} menuOpen={menu} onMenu={()=>setMenu(true)} onToggleSidebar={()=>setCollapsed(!collapsed)} onSearch={()=>show('search')} onNotifications={()=>show('notifications')} onMore={()=>show('more')}/>
   <main className="main fk-demo-main">
    <div className="fk-demo-note" role="status"><Sparkles size={18}/><span><strong>معاينة تفاعلية للتصميم فقط</strong> — بيانات توضيحية، بلا حساب أو اشتراك أو اتصال بقاعدة البيانات.</span></div>
    <div className="page-heading"><div><div className="eyebrow">FARMAKON / V10.1 PREVIEW</div><h1>{page==='dashboard'?'خطوتك القادمة في الصيدلة':names[page]}</h1><p>{page==='dashboard'?'هنا يظهر مركزك الدراسي بعد الدخول بحسابك الحقيقي.':'هذا مثال لكيفية ظهور القسم ضمن هيكل Farmakon الجديد.'}</p></div></div>
    {page==='dashboard'?<>
      <div className="fk-demo-overview">
       <div className="fk-demo-welcome"><span className="fk-demo-small">مساحة التعلّم الجديدة</span><h2>ادرس بذكاء وبمنهج واضح</h2><p>تابع محاضراتك، اختبر فهمك، واحفظ مصادر المراجعة في مكان واحد.</p><button type="button" onClick={()=>go('courses')}>استكشاف الكورسات <ChevronLeft size={17}/></button></div>
       <div className="fk-demo-feature"><img src="/farmakon-logo.jpg" width={75} height={75} alt="شعار Farmakon"/><strong>استكمال الدراسة</strong><p>عند توفر تقدم حقيقي، تظهر هنا آخر محاضرة والوقت الذي توقفت عنده.</p><span>لن نعرض تقدماً وهمياً</span></div>
      </div>
      <div className="fk-demo-metrics"><div><BookOpen/><small>كورساتي</small><strong>حسب الاشتراك</strong></div><div><CheckCircle2/><small>المحاضرات</small><strong>إنجاز فعلي</strong></div><div><GraduationCap/><small>الاختبارات</small><strong>نتائج محفوظة</strong></div></div>
      <div className="fk-demo-section-title"><h2>اختصارات الدراسة</h2><span>مفاتيح التنقل الحقيقية</span></div>
      <div className="fk-demo-shortcuts"><button onClick={()=>go('courses')}><BookOpen/><strong>الكورسات</strong><span>استعرض موادك</span><ChevronLeft/></button><button onClick={()=>go('questions')}><ClipboardList/><strong>بنك الأسئلة</strong><span>مراجعة واختبارات</span><ChevronLeft/></button><button onClick={()=>go('library')}><Library/><strong>المكتبة</strong><span>الملفات والمراجع</span><ChevronLeft/></button></div>
     </>:page==='courses'?<>
      <div className="fk-demo-section-title"><h2>بطاقات الكورسات</h2><span>نماذج تخطيطية فقط</span></div>
      <div className="fk-demo-courses"><article><div className="fk-demo-art"><BookOpen size={52}/><span>PHARMACY / PRACTICE</span></div><div className="fk-demo-course-body"><small>كورس نموذجي</small><h3>Pharmacology</h3><p>سوف تظهر تفاصيل الكورس الحقيقية هنا بعد تسجيل الدخول.</p><button type="button" onClick={()=>text('هذه بطاقة توضيحية وليست كورساً منشوراً.')}><span>شكل تفاصيل الكورس</span><ChevronLeft size={18}/></button></div></article><article><div className="fk-demo-art second"><Layers size={52}/><span>PHARMACY / EDUCATION</span></div><div className="fk-demo-course-body"><small>كورس نموذجي</small><h3>Physiology</h3><p>نفس التخطيط المتجاوب دون أي بيانات شخصية.</p><button type="button" onClick={()=>text('هذه بطاقة توضيحية وليست كورساً منشوراً.')}><span>شكل تفاصيل الكورس</span><ChevronLeft size={18}/></button></div></article></div>
     </>:<div className="fk-demo-placeholder"><div className="fk-demo-icon">{page==='library'?<Library/>:page==='questions'?<ClipboardList/>:page==='exams'?<GraduationCap/>:page==='account'?<ShieldCheck/>:page==='downloads'?<Download/>:page==='support'?<LifeBuoy/>:<Wallet/>}</div><h2>{names[page]}</h2><p>يمكنك تجربة فتح هذا القسم والرجوع، والقائمة الجانبية والشريط السفلي. المحتوى الحقيقي محمي ولا يظهر دون تسجيل الدخول.</p><button onClick={()=>go('dashboard')} type="button">العودة إلى الرئيسية <ArrowUpLeft size={17}/></button></div>}
    <footer className="fk-demo-footer">Farmakon V10.1 — Design Preview · No account required · No real data</footer>
   </main>
  </div>
  <MobileNavigation page={page} panel={panel} adminMode={false} onNavigate={go} onOpen={show}/>
  <ShellLayers panel={panel} onClose={()=>setPanel(null)} onNavigate={go} searchItems={examples} theme={theme} onTheme={toggleTheme} onInstall={()=>{setPanel(null);text('هذه معاينة تصميم فقط. تثبيت التطبيق متاح من موقع Farmakon الرسمي.')}} adminMode={false} onSidebar={()=>setMenu(true)} announcements={[]}/>
  {notice&&<div className="fk-demo-toast" role="status"><FileText size={18}/><span>{notice}</span><button type="button" aria-label="إغلاق التنبيه" onClick={()=>setNotice('')}><X size={16}/></button></div>}
 </div>;
}
