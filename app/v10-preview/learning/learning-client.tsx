'use client';
import {useEffect,useState,useCallback} from 'react';
import {
 BookOpen,BookMarked,BrainCircuit,Check,ChevronLeft,ClipboardCheck,ClipboardList,
 Clock3,FileText,FlaskConical,GraduationCap,House,Library,LifeBuoy,Menu,PanelRightClose,
 PlayCircle,RefreshCcw,Search,ShieldCheck,Smile,Stethoscope,Sparkles,Target,
 TrendingUp,Wallet,Download,X,CalendarDays,ArrowRight,Layers,Zap,LockKeyhole
} from 'lucide-react';
import {FarmakonHeader,MobileNavigation,ShellLayers,type ShellPanel,type SearchResult} from '../../components/v10-shell';
import LearningCenter from '../../components/learning-center';

type Direction='balanced'|'focus'|'academy';
type Section='learning'|'dashboard'|'courses'|'library'|'questions'|'exams'|'flashcards'|'cases'|'notes'|'revision'|'ai'|'account'|'subscriptions'|'downloads'|'support';
const directions:{id:Direction;name:string;desc:string}[]=[
 {id:'balanced',name:'1 · المتوازن',desc:'ترحيب + استكمال + أقسام متكاملة'},
 {id:'focus',name:'2 · التركيز',desc:'محاضرتك أولاً + خطة يومية هادئة'},
 {id:'academy',name:'3 · الأكاديمية',desc:'مركز أدوات واسع قابل للتوسّع'}
];
const content:{id:Section;name:string;hint:string;icon:typeof House;available:boolean}[]=[
 {id:'courses',name:'المحاضرات والكورسات',hint:'المواد والوحدات والفيديوهات',icon:BookOpen,available:true},
 {id:'questions',name:'بنك الأسئلة',hint:'تدريب وشرح الإجابات',icon:ClipboardList,available:true},
 {id:'exams',name:'الاختبارات',hint:'امتحانات وتجربة تقييم',icon:GraduationCap,available:true},
 {id:'revision',name:'المراجعة الذكية',hint:'مراجعة مبنية على تقدمك',icon:RefreshCcw,available:false},
 {id:'notes',name:'ملاحظاتي',hint:'ملفاتك وملاحظات الدراسة',icon:FileText,available:false},
 {id:'flashcards',name:'البطاقات التعليمية',hint:'حفظ سريع وتكرار متباعد',icon:Layers,available:false},
 {id:'cases',name:'الحالات السريرية',hint:'فكّر كصيدلاني',icon:Stethoscope,available:false},
 {id:'ai',name:'مساعد Farmakon AI',hint:'شرح ومراجعة من المصادر',icon:Sparkles,available:false}
];
const navEntries=[
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
const labels:Record<string,string>=Object.fromEntries([...navEntries.map(x=>[x.id,x.name]),...content.map(x=>[x.id,x.name])]);
const fakeSearch:SearchResult[]=[
 {id:'sample-course',title:'Pharmacology (مثال)',kind:'كورس توضيحي',section:'courses'},
 {id:'sample-library',title:'ملزمة تعليمية توضيحية',kind:'ملف توضيحي',section:'library'}
];
const encouragements=[
 {title:'كل خطوة اليوم تصنع فرقاً باچر ✨',sub:'نبدأ بشي بسيط، ونخلي المعلومة تثبت أكثر.'},
 {title:'جاهز تكمل رحلة الصيدلة؟ 💙',sub:'محاضرة واحدة اليوم أفضل من عشر خطط مؤجلة.'},
 {title:'مو شرط تخلص كلشي اليوم 🌟',sub:'المهم تتقدم، ولو بخطوة صغيرة.'},
 {title:'ذاكرتك تحب المراجعة الذكية 🧠',sub:'تعلّم، اختبر نفسك، وارجع للأهم.'}
];
const steps=[{name:'راجع آخر محاضرة',icon:PlayCircle},{name:'جاوب على أسئلة التدريب',icon:ClipboardCheck},{name:'احفظ نقطة مهمة',icon:BookMarked}];
function learningItem(key:Section){return content.find(x=>x.id===key)}
export default function LearningDesignPreview(){
 const [direction,setDirection]=useState<Direction>('balanced');
 useEffect(()=>{const chosen=new URLSearchParams(window.location.search).get('design');if(chosen==='balanced'||chosen==='focus'||chosen==='academy')setDirection(chosen)},[]);
 const [section,setSection]=useState<Section>('learning');
 const [panel,setPanel]=useState<ShellPanel>(null);
 const [menu,setMenu]=useState(false);
 const [collapsed,setCollapsed]=useState(false);
 const [theme,setTheme]=useState<'dark'|'light'>('dark');
 const [student,setStudent]=useState('طالب Farmakon');
 const [greeting,setGreeting]=useState(0);
 const [hour,setHour]=useState(12);
 const [checked,setChecked]=useState<number[]>([]);
 const [toast,setToast]=useState('');
 useEffect(()=>{setHour(new Date().getHours());document.documentElement.dataset.theme=theme;return()=>{document.documentElement.removeAttribute('data-theme')}},[theme]);
 useEffect(()=>{if(!menu)return;const before=document.body.style.overflow;document.body.style.overflow='hidden';const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')setMenu(false)};document.addEventListener('keydown',onKey);return()=>{document.body.style.overflow=before;document.removeEventListener('keydown',onKey)}},[menu]);
 const go=useCallback((id:string)=>{setPanel(null);setMenu(false);if(labels[id]){setSection(id as Section);window.scrollTo({top:0,behavior:'smooth'})}else setToast('هذا القسم ضمن التطوير القادم، ولا يحتوي بعد على بيانات حقيقية.');},[]);
 const greet=hour<11?'صباح الخير':hour<17?'نهارك سعيد':'مساء الخير';
 const open=(type:ShellPanel)=>{setMenu(false);setPanel(type)};
 const action=(id:Section)=>{
  const item=learningItem(id);
  if(item&&!item.available){setToast('معاينة لتصميم قسم «'+item.name+'»؛ التنفيذ الكامل سيكون في مرحلة مستقلة.');return}
  go(id);
 };
 const message=(msg:string)=>setToast(msg);
 const back=()=>{setSection('learning');window.scrollTo({top:0,behavior:'smooth'})};
 const previewBanner=<div className="fk-lab-banner"><Sparkles size={17}/><span><strong>معاينة تصميم تفاعلية</strong> — المحتوى والاسم والتقدم أمثلة فقط. لا حساب ولا بيانات طلاب.</span></div>;
 const hero=<section className="fk-learn-hero" aria-label="بطاقة الترحيب">
   <div className="fk-learn-hero-copy">
    <span className="fk-learn-eyebrow"><span className="fk-mini-dot"/> FARMAKON LEARNING HUB</span>
    <p className="fk-learn-hi">{greet}، <strong>{student}</strong> <span aria-hidden="true">👋</span></p>
    <h2>{encouragements[greeting].title}</h2>
    <p className="fk-learn-hero-desc">{encouragements[greeting].sub}</p>
    <div className="fk-learn-hero-actions">
      <button type="button" className="fk-learn-primary" onClick={()=>action('courses')}>ابدأ الدراسة <ChevronLeft size={17}/></button>
      <button type="button" className="fk-learn-icon-action" onClick={()=>setGreeting((greeting+1)%encouragements.length)} title="رسالة تحفيزية أخرى" aria-label="تغيير رسالة الترحيب"><RefreshCcw size={17}/></button>
    </div>
   </div>
   <div className="fk-learn-hero-art" aria-hidden="true"><div className="fk-art-ring fk-art-ring1"/><div className="fk-art-ring fk-art-ring2"/><img src="/farmakon-logo.jpg" alt="" width={105} height={105}/><span className="fk-art-spark fk-art-spark1">✦</span><span className="fk-art-spark fk-art-spark2">✧</span></div>
 </section>;
 const resume=<section className="fk-resume-card"><div className="fk-learning-tile-icon"><PlayCircle size={25}/></div><div className="fk-resume-copy"><small>كمّل من وين وقفت</small><strong>آخر محاضرة راح تظهر هنا</strong><p>بعد تسجيل الدخول، نعرض اسم الدرس والوقت المحفوظ من بياناتك الحقيقية.</p></div><button type="button" onClick={()=>message('هذه بطاقة عرض فقط. عند التنفيذ سيتم ربطها بآخر محاضرة حقيقية.')} aria-label="معاينة زر المتابعة"><ChevronLeft size={19}/></button></section>;
 const task=<section className="fk-plan-card"><div className="fk-learning-section-head"><div><span className="fk-learn-kicker">YOUR STUDY PLAN</span><h3>خطة اليوم</h3></div><span className="fk-demo-label">تجريبية</span></div><p className="fk-learn-muted">هذه خطوات تفاعلية لتجربة شكل الخطة، وليست مهمات محفوظة بحسابك.</p><div className="fk-plan-list">{steps.map((step,i)=>{const Icon=step.icon;const yes=checked.includes(i);return <button type="button" key={i} aria-pressed={yes} onClick={()=>setChecked(old=>yes?old.filter(n=>n!==i):[...old,i])} className={'fk-plan-step '+(yes?'done':'')}><span className="fk-plan-check">{yes?<Check size={15}/>:<Icon size={18}/>}</span><span>{step.name}</span><small>{yes?'تم في المعاينة':'جرّب الضغط'}</small></button>})}</div></section>;
 const tools=(limit=8)=><section className="fk-learn-tools"><div className="fk-learning-section-head"><div><span className="fk-learn-kicker">YOUR LEARNING SPACE</span><h3>أقسام التعلّم</h3></div><small>مساحة تتوسع ويّا المنصة</small></div><div className="fk-learn-tool-grid">{content.slice(0,limit).map((item,i)=>{const Icon=item.icon;return <button type="button" className="fk-learn-tool" key={item.id} onClick={()=>action(item.id)}><span className={'fk-tool-glyph fk-glyph-'+(i%4)}><Icon size={23}/></span><strong>{item.name}</strong><small>{item.hint}</small>{!item.available&&<span className="fk-learn-upcoming">مقترح للتطوير</span>}<ChevronLeft size={15} className="fk-tool-arrow"/></button>})}</div></section>;
 const snapshot=<section className="fk-learn-snapshot"><div className="fk-learning-section-head"><div><span className="fk-learn-kicker">MY PROGRESS</span><h3>تقدمك الدراسي</h3></div></div><div className="fk-snapshot-grid"><div><BookOpen size={21}/><small>كورساتي</small><strong>من اشتراكاتك</strong></div><div><Target size={21}/><small>إنجاز المحاضرات</small><strong>من نشاطك</strong></div><div><TrendingUp size={21}/><small>نتائج الاختبارات</small><strong>عند توفرها</strong></div></div></section>;
 return <div dir="rtl" className={'app fk-app fk-demo-app fk-learning-preview '+(collapsed?'fk-compact':'')} data-layout={direction}>
   <aside className={'sidebar '+(menu?'open ':'')+(collapsed?'is-collapsed':'')} id="learning-preview-sidebar" aria-label="قائمة معاينة التعلّم">
    <button className="fk-collapse" type="button" onClick={()=>setCollapsed(!collapsed)} aria-label="طي القائمة"><PanelRightClose size={20}/></button>
    <a className="brand" href="/v10-preview/learning" aria-label="Farmakon"><img src="/farmakon-logo.jpg" width={50} height={50} alt=""/><div><b>Farmakon</b><small>أكاديمية الصيدلة</small></div></a>
    <button type="button" className="mobile-close icon-btn" onClick={()=>setMenu(false)} aria-label="إغلاق القائمة"><X size={20}/></button>
    <div className="space-label">مساحة التعلّم</div>
    <nav aria-label="الأقسام">{navEntries.map(l=>{const Icon=l.icon;return <button type="button" title={l.name} className={section===l.id?'nav-item selected':'nav-item'} key={l.id} onClick={()=>go(l.id)}><Icon size={19}/>{l.name}</button>})}</nav>
    <div className="sidebar-bottom"><div className="mini-card"><Sparkles size={22}/><strong>تصميم مستقبلي</strong><small>بيانات توضيحية لا تُحفظ.</small></div></div>
   </aside>
   {menu&&<div className="shade" role="presentation" onClick={()=>setMenu(false)}/>}
   <div className="workspace">
    <FarmakonHeader title={labels[section]||'مركز التعلّم'} menuOpen={menu} onMenu={()=>setMenu(true)} onToggleSidebar={()=>setCollapsed(!collapsed)} onSearch={()=>open('search')} onNotifications={()=>open('notifications')} onMore={()=>open('more')}/>
    <main className="main fk-learning-main">
     {previewBanner}
     <div className="fk-learning-picker" aria-label="اختيار تصميم مركز التعلّم">
      <div className="fk-picker-head"><div><span className="fk-learn-kicker">DESIGN PREVIEWS</span><h1>مركز التعلّم — كيف تتخيله؟</h1></div><span className="fk-picker-counter">3 تصاميم</span></div>
      <div role="tablist" aria-label="نسخ التصميم" className="fk-picker-tabs">{directions.map(d=><button type="button" role="tab" aria-selected={direction===d.id} className={direction===d.id?'selected':''} key={d.id} onClick={()=>{setDirection(d.id);setSection('learning');const u=new URL(window.location.href);u.searchParams.set('design',d.id);window.history.replaceState(null,'',u.pathname+u.search)}}><strong>{d.name}</strong><small>{d.desc}</small></button>)}</div>
     </div>
     <div className="fk-preview-greeting-controls"><span><Smile size={16}/> جرّب الترحيب باسم نموذجي:</span><button className={student==='طالب Farmakon'?'selected':''} onClick={()=>setStudent('طالب Farmakon')}>عام</button><button className={student==='أحمد'?'selected':''} onClick={()=>setStudent('أحمد')}>أحمد</button><button className={student==='سارة'?'selected':''} onClick={()=>setStudent('سارة')}>سارة</button></div>
     {section!=='learning'?<div className="fk-learning-subpage"><button className="fk-learn-back" onClick={back}><ArrowRight size={18}/> العودة إلى مركز التعلّم</button><div className="fk-learning-subpage-card"><div className="fk-learning-tile-icon">{(()=>{const item=navEntries.find(x=>x.id===section)||learningItem(section);const Icon=item?.icon||BookOpen;return <Icon size={34}/>})()}</div><h2>{labels[section]}</h2><p>توضيح للانتقال من مركز التعلّم إلى هذا القسم. ربط المحتوى الحقيقي سيتم ضمن تطوير القسم الخاص به، وتبقى بيانات الطلاب محمية.</p><button className="fk-learn-primary" onClick={back}>الرجوع للمركز <ArrowRight size={17}/></button></div></div>:
     direction==='balanced'?<LearningCenter isPreview userName={student}
 courses={[]} lessons={[]} activity={[]} enrollments={[]} questions={[]} exams={[]} files={[]}
 onNavigate={go}/>:direction==='focus'?<div className="fk-learning-direction fk-learning-focus">
       <section className="fk-focus-top"><div><span className="fk-learn-eyebrow">FOCUS MODE · فارماكون</span><p>{greet}، {student} 👋</p><h2>كل يوم، خطوة تقرّبك من هدفك.</h2><span>محاضرة واحدة، مراجعة صغيرة، وثبات في التعلّم.</span><button onClick={()=>setGreeting((greeting+1)%encouragements.length)} className="fk-focus-quote"><Sparkles size={16}/>{encouragements[greeting].title}<RefreshCcw size={16}/></button></div><img src="/farmakon-logo.jpg" width={82} height={82} alt=""/></section>
       <div className="fk-focus-columns"><div><div className="fk-learning-section-head"><h3>ابدأ من هنا</h3><span className="fk-demo-label">مقترح</span></div>{resume}<div className="fk-focus-quick"><button onClick={()=>action('courses')}><PlayCircle/> المحاضرات</button><button onClick={()=>action('questions')}><ClipboardList/> الأسئلة</button><button onClick={()=>action('exams')}><GraduationCap/> الاختبارات</button></div></div>{task}</div>{tools(6)}
       <div className="fk-focus-tip"><BrainCircuit size={23}/><p>الصفحة تركّز على المهمة التالية؛ بقية الأدوات تبقى متاحة بدون ما تشتّت الطالب.</p></div>
      </div>:<div className="fk-learning-direction fk-learning-academy">
       <section className="fk-academy-banner"><div><span className="fk-learn-eyebrow">FARMAKON / STUDENT ACADEMY</span><p>{greet}، {student} 👋</p><h2>كل أدوات دراستك، بمكان واحد.</h2><span>اختر مسارك وكمّل بتدرّج — تعلّم، طبّق، راجع.</span><button onClick={()=>setGreeting((greeting+1)%encouragements.length)}><Sparkles size={16}/>{encouragements[greeting].title}</button></div><div className="fk-academy-illustration"><BrainCircuit size={72}/><span>LEARN · PRACTICE · GROW</span></div></section>
       <div className="fk-academy-spotlight"><div><span className="fk-learn-kicker">NEXT STEP</span><h3>تابع رحلتك</h3><p>آخر محتوى دراسي يتحدد من حسابك عند تفعيل الميزة.</p></div><button onClick={()=>action('courses')}>اذهب للكورسات <ChevronLeft size={17}/></button></div>
       {tools(8)}
       <div className="fk-academy-extra"><div className="fk-academy-card"><CalendarDays size={25}/><h3>خطة اليوم</h3><p>مهمات قصيرة مرتبطة بمحاضراتك ومستوى تقدمك الحقيقي.</p><button onClick={()=>message('هذه فكرة مقترحة لتخطيط الدراسة، وليست مهمة مجدولة حالياً.')}>استكشف الفكرة <ChevronLeft size={16}/></button></div><div className="fk-academy-card"><FlaskConical size={25}/><h3>تدرّب سريرياً</h3><p>حالات عملية صيدلانية ترتبط بالمحاضرات والمصادر المعتمدة.</p><button onClick={()=>action('cases')}>استكشف الفكرة <ChevronLeft size={16}/></button></div></div>{snapshot}
      </div>}
     <div className="fk-learn-review-note"><LockKeyhole size={17}/> هذه المقترحات لا تغيّر واجهة تسجيل الدخول أو قاعدة البيانات أو الموقع الرسمي. اختر التصميم الأقرب لذوقك لنطوره لاحقاً.</div>
    </main>
   </div>
   <MobileNavigation page={section} adminMode={false} onNavigate={go} panel={panel} learningAsPage={true} onOpen={open}/>
   <ShellLayers panel={panel} onClose={()=>setPanel(null)} onNavigate={go} searchItems={fakeSearch} theme={theme} onTheme={()=>setTheme(t=>t==='dark'?'light':'dark')} onInstall={()=>message('التثبيت متاح من الموقع الرسمي. هذه معاينة تصميم فقط.')} adminMode={false} onSidebar={()=>setMenu(true)} announcements={[]}/>
   {toast&&<div role="status" className="fk-demo-toast"><Sparkles size={18}/><span>{toast}</span><button type="button" onClick={()=>setToast('')} aria-label="إغلاق الرسالة"><X size={17}/></button></div>}
  </div>;
}
