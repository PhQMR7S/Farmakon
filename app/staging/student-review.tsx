'use client';
import {useEffect,useState} from 'react';
import {BookOpen,GraduationCap,House,Library,ClipboardList,ClipboardCheck,ShieldCheck,Wallet,Download,LifeBuoy,Sparkles,PanelRightClose,X,ArrowRight} from 'lucide-react';
import {FarmakonHeader,MobileNavigation,ShellLayers,type ShellPanel,type SearchResult} from '../../components/v10-shell';
import LearningCenter from '../../components/learning-center';

type Section='learning'|'dashboard'|'courses'|'library'|'questions'|'exams'|'account'|'subscriptions'|'downloads'|'support';
const links=[
 {id:'learning' as Section,name:'مركز التعلّم',icon:GraduationCap},
 {id:'dashboard' as Section,name:'الرئيسية',icon:House},
 {id:'courses' as Section,name:'كورساتي',icon:BookOpen},
 {id:'library' as Section,name:'المكتبة العلمية',icon:Library},
 {id:'questions' as Section,name:'بنك الأسئلة',icon:ClipboardList},
 {id:'exams' as Section,name:'الاختبارات',icon:ClipboardCheck},
 {id:'account' as Section,name:'حسابي',icon:ShieldCheck},
 {id:'subscriptions' as Section,name:'اشتراكاتي',icon:Wallet},
 {id:'downloads' as Section,name:'التنزيلات',icon:Download},
 {id:'support' as Section,name:'المساعدة والدعم',icon:LifeBuoy}
];
const names=Object.fromEntries(links.map(l=>[l.id,l.name])) as Record<string,string>;
const examples:SearchResult[]=[];
export default function StudentStagingReview({userName,userId,authSessionKey}:{userName:string;userId:string;authSessionKey:string}){
 const [section,setSection]=useState<Section>('learning');
 const [panel,setPanel]=useState<ShellPanel>(null);
 const [menu,setMenu]=useState(false);
 const [collapsed,setCollapsed]=useState(false);
 const [theme,setTheme]=useState<'dark'|'light'>('dark');
 const [notice,setNotice]=useState('');
 useEffect(()=>{document.documentElement.dataset.theme=theme;return()=>{document.documentElement.removeAttribute('data-theme')}},[theme]);
 useEffect(()=>{
  if(!menu)return;
  const old=document.body.style.overflow;document.body.style.overflow='hidden';
  const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')setMenu(false)};
  document.addEventListener('keydown',onKey);
  return()=>{document.body.style.overflow=old;document.removeEventListener('keydown',onKey)};
 },[menu]);
 function go(page:string){
  setPanel(null);setMenu(false);
  if(page in names){setSection(page as Section);window.scrollTo({top:0,behavior:'smooth'})}
  else setNotice('هذا القسم ضمن خطة التطوير القادمة.');
 }
 function toggleTheme(){setTheme(v=>v==='dark'?'light':'dark')}
 return <div dir="rtl" className={'app fk-app fk-demo-app fk-learning-preview '+(collapsed?'fk-compact':'')}>
  <aside className={'sidebar '+(menu?'open ':'')+(collapsed?'is-collapsed':'')} aria-label="قائمة معاينة Farmakon">
   <button type="button" className="fk-collapse" aria-label="طي القائمة" onClick={()=>setCollapsed(c=>!c)}><PanelRightClose size={20}/></button>
   <a className="brand" href="/"><img src="/farmakon-logo.jpg" alt="" width={50} height={50}/><div><b>Farmakon</b><small>أكاديمية الصيدلة</small></div></a>
   <button type="button" className="mobile-close icon-btn" aria-label="إغلاق القائمة" onClick={()=>setMenu(false)}><X size={20}/></button>
   <div className="space-label">مساحة التعلّم</div>
   <nav aria-label="الأقسام">{links.map(l=>{const Icon=l.icon;return <button type="button" key={l.id} className={'nav-item '+(section===l.id?'selected':'')} onClick={()=>go(l.id)}><Icon size={19}/>{l.name}</button>})}</nav>
   <div className="sidebar-bottom"><div className="mini-card"><Sparkles size={22}/><strong>معاينة معتمدة</strong><small>لا تستخدم بيانات طلاب حقيقية.</small></div></div>
  </aside>
  {menu&&<div role="presentation" className="shade" onClick={()=>setMenu(false)}/>}
  <div className="workspace">
   <FarmakonHeader title={names[section]||'مركز التعلّم'} menuOpen={menu} onMenu={()=>setMenu(true)} onToggleSidebar={()=>setCollapsed(c=>!c)} onSearch={()=>setPanel('search')} onNotifications={()=>setPanel('notifications')} onMore={()=>setPanel('more')}/>
   <main className="main fk-learning-main">
    <div className="fk-lab-banner" role="status"><Sparkles size={17}/><span><strong>تجربة الطالب — V10.2</strong> — هذا اسمك الحقيقي من حساب Staging. الكورسات والتقدم هنا للمعاينة التصميمية فقط إلى أن يكتمل ربط قاعدة الاختبار.</span></div>
    {section==='learning'?<LearningCenter isPreview authenticatedPreview userName={userName} userId={userId} authSessionKey={authSessionKey} courses={[]} lessons={[]} enrollments={[]} activity={[]} questions={[]} exams={[]} files={[]} onNavigate={go}/>:
    <div className="fk-learning-subpage">
     <button type="button" className="fk-learn-back" onClick={()=>go('learning')}><ArrowRight size={17}/> العودة إلى مركز التعلّم</button>
     <div className="fk-learning-subpage-card">
      <div className="fk-learning-tile-icon">{(()=>{const item=links.find(l=>l.id===section),Icon=item?.icon||BookOpen;return <Icon size={34}/>})()}</div>
      <h2>{names[section]}</h2>
      <p>هذه معاينة تصميمية. افتح نسخة Staging لتسجيل حساب طالب وتجربة بيانات الكورسات والاختبارات الحقيقية في بيئة منفصلة.</p>
      {section==='account'&&<a className="fk-learn-primary" href="/logout">تسجيل الخروج</a>}<button type="button" className="fk-learn-primary" onClick={()=>go('learning')}>العودة للمركز <ArrowRight size={17}/></button>
     </div>
    </div>}
   </main>
  </div>
  <MobileNavigation page={section} panel={panel} adminMode={false} learningAsPage onNavigate={go} onOpen={setPanel}/>
  <ShellLayers panel={panel} onClose={()=>setPanel(null)} onNavigate={go} searchItems={examples} theme={theme} onTheme={toggleTheme} onInstall={()=>setNotice('التثبيت متاح من الموقع الرسمي بعد الاعتماد النهائي.')} adminMode={false} onSidebar={()=>setMenu(true)} announcements={[]}/>
  {notice&&<div className="fk-demo-toast" role="status"><Sparkles size={18}/><span>{notice}</span><button type="button" aria-label="إغلاق التنبيه" onClick={()=>setNotice('')}><X size={17}/></button></div>}
 </div>;
}
