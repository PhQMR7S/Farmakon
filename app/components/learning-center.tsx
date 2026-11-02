'use client';
import {useEffect,useMemo,useState} from 'react';
import {
 ArrowLeft,BookMarked,BookOpen,BrainCircuit,Check,ChevronLeft,ClipboardCheck,
 ClipboardList,Clock3,FileText,GraduationCap,Library,PlayCircle,RefreshCcw,
 Sparkles,Stethoscope,Target,TrendingUp,Layers,Heart,CalendarDays,LockKeyhole
} from 'lucide-react';

type RecordItem=Record<string,any>;
type ActionId='courses'|'questions'|'exams'|'library'|'notes'|'flashcards'|'cases'|'ai'|'review';
type SectionInfo={id:ActionId;title:string;description:string;icon:typeof BookOpen;live:boolean;accent:'cyan'|'violet'|'coral'|'mint'};
const sections:SectionInfo[]=[
 {id:'courses',title:'المحاضرات والكورسات',description:'موادك ومحاضراتك في مكان واحد',icon:BookOpen,live:true,accent:'cyan'},
 {id:'questions',title:'بنك الأسئلة',description:'تدرّب مع شرح الإجابات',icon:ClipboardList,live:true,accent:'violet'},
 {id:'exams',title:'الاختبارات',description:'اختبر فهمك وتابع نتائجك',icon:GraduationCap,live:true,accent:'coral'},
 {id:'library',title:'المكتبة العلمية',description:'الملازم والملفات والمصادر',icon:Library,live:true,accent:'mint'},
 {id:'notes',title:'ملاحظاتي',description:'ملاحظات مرتبطة بمحاضراتك',icon:FileText,live:false,accent:'cyan'},
 {id:'flashcards',title:'البطاقات التعليمية',description:'بطاقات مراجعة وتكرار متباعد',icon:Layers,live:false,accent:'violet'},
 {id:'cases',title:'الحالات السريرية',description:'تعلّم التفكير السريري',icon:Stethoscope,live:false,accent:'coral'},
 {id:'ai',title:'مساعد Farmakon AI',description:'شرح بمصادر محاضراتك',icon:BrainCircuit,live:false,accent:'mint'},
];
const motivations=[
 {title:'كل خطوة اليوم تقرّبك من هدفك.',subtitle:'محاضرة واحدة تتعلّمها بإتقان أفضل من ساعات بلا تركيز.',icon:Target},
 {title:'تعلّم بذكاء، وتقدّم بثبات.',subtitle:'راجع فكرة، اختبر فهمك، وكمّل الطريق بثقة.',icon:BrainCircuit},
 {title:'إنجاز صغير اليوم يصنع فرقاً باچر.',subtitle:'لا تستعجل النتيجة؛ كل معلومة تفهمها تبني مستقبلك.',icon:Sparkles},
 {title:'جاهز تضيف معلومة جديدة لرصيدك؟',subtitle:'ابدأ بما تقدر عليه اليوم، وخلي المراجعة عادة بسيطة.',icon:BookMarked},
 {title:'الخطوة الجاية أقرب مما تتوقع.',subtitle:'قسّم الدراسة إلى خطوات واضحة، وخلي التقدم مستمر.',icon:Heart}
];
function firstName(name?:string){const cleaned=String(name||'').trim().replace(/\s+/g,' ');const first=cleaned.split(' ')[0]||'';return first.length>22?'':first}
function greetingFor(hour:number){return hour>=5&&hour<12?'صباح الخير':hour>=12&&hour<17?'نهارك سعيد':hour>=17&&hour<23?'مساء الخير':'أهلاً بعودتك'}
function lastTimestamp(row:RecordItem){return Number(row.updated||row.created||0)||0}
function elapsed(seconds:number){const minutes=Math.floor((Number(seconds)||0)/60);return minutes>=60?`${Math.floor(minutes/60)} س و${minutes%60} د`:`${minutes} دقيقة`}
export type LearningCenterProps={
 userName?:string;userId?:string;courses?:RecordItem[];lessons?:RecordItem[];
 enrollments?:RecordItem[];activity?:RecordItem[];questions?:RecordItem[];exams?:RecordItem[];
 files?:RecordItem[];isPreview?:boolean;
 onNavigate:(section:string)=>void;
 onResume?:(lesson:RecordItem,course:RecordItem)=>void;
};
export default function LearningCenter({userName,userId='preview',courses=[],lessons=[],enrollments=[],activity=[],questions=[],exams=[],files=[],isPreview=false,onNavigate,onResume}:LearningCenterProps){
 const [hour,setHour]=useState(12);
 const [messageIndex,setMessageIndex]=useState(0);
 const [ready,setReady]=useState(false);
 const [marked,setMarked]=useState<string[]>([]);
 const [iconPulse,setIconPulse]=useState(false);
 const [notice,setNotice]=useState('');
 const uid=String(userId||'preview');
 useEffect(()=>{
   setHour(new Date().getHours());
   // Once per browser login/tab; sign-out clears this key. Avoid repeat of last message.
   const sessionKey='fk-v102-welcome:'+uid;
   let index=Number(window.sessionStorage.getItem(sessionKey));
   if(!Number.isInteger(index)||index<0||index>=motivations.length){
     const prev=Number(window.localStorage.getItem('fk-v102-last-welcome:'+uid));
     const choices=motivations.map((_,i)=>i).filter(i=>i!==prev);
     index=choices[Math.floor(Math.random()*choices.length)]??0;
     window.sessionStorage.setItem(sessionKey,String(index));
     window.localStorage.setItem('fk-v102-last-welcome:'+uid,String(index));
   }
   setMessageIndex(index);
   const dayKey=new Date().toLocaleDateString('en-CA');
   try{const raw=JSON.parse(window.localStorage.getItem('fk-v102-plan:'+uid+':'+dayKey)||'[]');setMarked(Array.isArray(raw)?raw.filter(v=>typeof v==='string'):[])}catch{setMarked([])}
   setReady(true);
 },[uid]);
 const activeCourses=useMemo(()=>new Set(enrollments.filter(e=>e.expires>Date.now()).map(e=>e.course_id)),[enrollments]);
 const allowedLessons=useMemo(()=>lessons.filter(l=>l.status==='published'&&!l.locked&&courses.some(c=>c.id===l.courseId&&c.status==='published')),[lessons,courses]);
 const progress=useMemo(()=>activity.filter(a=>a.kind==='progress'&&allowedLessons.some(l=>l.id===a.target)),[activity,allowedLessons]);
 const completed=useMemo(()=>new Set(progress.filter(p=>p.data?.completed).map(p=>p.target)).size,[progress]);
 const resume=useMemo(()=>progress.filter(p=>!p.data?.completed).sort((a,b)=>lastTimestamp(b)-lastTimestamp(a)).map(p=>{
  const lesson=allowedLessons.find(l=>l.id===p.target);
  const course=courses.find(c=>c.id===lesson?.courseId);
  return lesson&&course?{lesson,course,seconds:Math.max(0,Math.min(Number(p.data?.seconds)||0,(Number(lesson.minutes)||0)*60||86400))}:null
 }).find(Boolean),[progress,allowedLessons,courses]) as {lesson:RecordItem;course:RecordItem;seconds:number}|undefined;
 const publicCourses=courses.filter(c=>c.status==='published');
 const availableQuestions=questions.filter(q=>q.status==='published');
 const availableFiles=files.filter(f=>f.status==='published');
 const visibleExams=exams.filter(e=>e.status==='published');
 const examActivity=activity.filter(a=>a.kind==='exam');
 const recent=activity.filter(a=>(a.kind==='progress'&&allowedLessons.some(l=>l.id===a.target))||a.kind==='exam').sort((a,b)=>lastTimestamp(b)-lastTimestamp(a)).slice(0,3);
 const tasks=[
  {id:'study',text:resume?'استكمل المحاضرة التي توقفت عندها':'استكشف محاضراتك المتاحة',destination:'courses' as ActionId,icon:PlayCircle},
  {id:'quiz',text:availableQuestions.length?'راجع مجموعة أسئلة':'تصفّح بنك الأسئلة',destination:'questions' as ActionId,icon:ClipboardCheck},
  {id:'review',text:availableFiles.length?'راجع ملفاً علمياً':'تصفّح المكتبة العلمية',destination:'library' as ActionId,icon:BookMarked}
 ];
 function go(id:ActionId){const s=sections.find(x=>x.id===id);
   if(s&&!s.live){setNotice('ميزة «'+s.title+'» ضمن خطة التطوير القادمة؛ لن نعرضها كميزة مفعّلة قبل تجهيزها.');return}
   if(id==='review'){setNotice('المراجعة الذكية ضمن خطة التطوير القادمة.');return}
   onNavigate(id);
 }
 function toggleTask(id:string){
  setMarked(prev=>{
   const next=prev.includes(id)?prev.filter(x=>x!==id):[...prev,id];
   if(!isPreview){const dayKey=new Date().toLocaleDateString('en-CA');window.localStorage.setItem('fk-v102-plan:'+uid+':'+dayKey,JSON.stringify(next))}
   return next;
  });
 }
 const first=firstName(userName);
 const current=motivations[messageIndex];
 const Icon=current.icon;
 const greeting=greetingFor(hour);
 return <div className="fk-learning-preview fk-learning-v102" dir="rtl">
   {isPreview&&<div className="fk-lab-banner" role="status"><Sparkles size={17}/><span><strong>معاينة V10.2</strong> — الأسماء والمحتوى توضيحية، بدون اتصال ببيانات الطالب.</span></div>}
   <section className="fk-learn-hero fk-v102-hero" aria-label="الترحيب الشخصي">
    <div className="fk-learn-hero-copy">
      <span className="fk-learn-eyebrow">FARMAKON · LEARNING SPACE</span>
      <p className="fk-learn-hi">{greeting}{first?'، '+first:''}<span className="fk-v102-greet-mark" aria-hidden="true"><Sparkles size={15}/></span></p>
      <h2>{ready?current.title:motivations[0].title}</h2>
      <p className="fk-learn-hero-desc">{ready?current.subtitle:motivations[0].subtitle}</p>
      <div className="fk-learn-hero-actions">
       <button className="fk-learn-primary" type="button" onClick={()=>resume&&onResume?onResume(resume.lesson,resume.course):go('courses')}>{resume?'كمّل محاضرتك':'ابدأ التعلّم'}<ChevronLeft size={17}/></button>
       {isPreview&&<button type="button" className="fk-learn-icon-action" title="تجربة رسالة أخرى" aria-label="تجربة رسالة تحفيزية أخرى" onClick={()=>setMessageIndex(i=>(i+1)%motivations.length)}><RefreshCcw size={17}/></button>}
      </div>
    </div>
    <div className="fk-v102-hero-illustration" aria-hidden="true">
      <div className="fk-v102-icon3d fk-v102-hero-medal"><Icon size={58} strokeWidth={1.8}/></div>
      <div className="fk-v102-orbit fk-v102-orbit-a"/><div className="fk-v102-orbit fk-v102-orbit-b"/>
      <div className="fk-v102-logo-orb"><img src="/farmakon-logo.jpg" width="50" height="50" alt=""/></div>
    </div>
   </section>
   <section className="fk-resume-card fk-v102-resume" aria-label="استكمال الدراسة">
    <span className="fk-v102-icon3d fk-v102-mini-icon fk-v102-blue"><PlayCircle size={26}/></span>
    <div className="fk-resume-copy">
     <small>كمّل من وين وقفت</small>
     <strong>{resume?String(resume.lesson.title):activeCourses.size?'جاهز لأول محاضرة؟':'ابدأ رحلتك الدراسية'}</strong>
     <p>{resume?`${resume.course.title} · توقفت عند ${elapsed(resume.seconds)}`:activeCourses.size?'اختَر محاضرة من كورساتك المشترك بها.':'استكشف الكورسات المتاحة وابدأ التعلّم.'}</p>
    </div>
    <button type="button" aria-label={resume?'متابعة المحاضرة':'فتح الكورسات'} onClick={()=>resume&&onResume?onResume(resume.lesson,resume.course):go('courses')}><ChevronLeft size={20}/></button>
   </section>
   <section className="fk-learn-tools" aria-labelledby="fk-v102-tools-title">
    <div className="fk-learning-section-head"><div><span className="fk-learn-kicker">YOUR LEARNING TOOLS</span><h3 id="fk-v102-tools-title">أقسام التعلّم</h3></div><small>مرتبّة وقابلة للتوسّع</small></div>
    <div className="fk-learn-tool-grid">{sections.map(s=>{const S=s.icon;return <button type="button" key={s.id} className={'fk-learn-tool fk-v102-tool '+(!s.live?'fk-v102-coming':'')} onClick={()=>go(s.id)} aria-label={s.title+(s.live?'':' — قيد التطوير')}>
      <span className={'fk-v102-icon3d fk-v102-tool-icon fk-v102-'+s.accent}><S size={25} strokeWidth={1.85}/></span>
      <strong>{s.title}</strong><small>{s.description}</small>
      {!s.live&&<span className="fk-learn-upcoming">قيد التطوير</span>}
      <ChevronLeft className="fk-tool-arrow" size={15}/>
    </button>})}</div>
   </section>
   <section className="fk-plan-card fk-v102-plan" aria-labelledby="fk-v102-plan-title">
    <div className="fk-learning-section-head"><div><span className="fk-learn-kicker">TODAY'S STUDY</span><h3 id="fk-v102-plan-title">خطة دراسة بسيطة</h3></div><span className="fk-demo-label">تتبّع {isPreview?'توضيحي':'على هذا الجهاز'}</span></div>
    <p className="fk-learn-muted">اختَر مهمة وعلّمها بعد إنجازها. التحديد هنا شخصي ولا يغيّر نسب إنجاز محاضراتك أو نتائجك الرسمية.</p>
    <div className="fk-plan-list">{tasks.map(t=>{const T=t.icon;const done=marked.includes(t.id);return <div key={t.id} className={'fk-v102-plan-row '+(done?'done':'')}>
     <button type="button" className="fk-v102-task-mark" aria-label={(done?'إلغاء تحديد':'تحديد إنجاز')+' '+t.text} aria-pressed={done} onClick={()=>toggleTask(t.id)}>{done?<Check size={18}/>:<span/>}</button>
     <T className="fk-v102-task-icon" size={19}/>
     <span>{t.text}</span>
     <button className="fk-v102-task-open" type="button" aria-label={'فتح '+t.text} onClick={()=>go(t.destination)}><ChevronLeft size={17}/></button>
    </div>})}</div>
   </section>
   <section className="fk-learn-snapshot fk-v102-stats" aria-labelledby="fk-v102-stats-title">
     <div className="fk-learning-section-head"><div><span className="fk-learn-kicker">YOUR PROGRESS</span><h3 id="fk-v102-stats-title">تقدمك الدراسي</h3></div></div>
     <div className="fk-snapshot-grid">
      <div><BookOpen size={21}/><small>كورساتي النشطة</small><strong>{isPreview?'—':activeCourses.size}</strong></div>
      <div><Target size={21}/><small>المحاضرات المكتملة</small><strong>{isPreview?'—':completed}</strong></div>
      <div><TrendingUp size={21}/><small>محاولات الاختبار</small><strong>{isPreview?'—':examActivity.length}</strong></div>
     </div>
   </section>
   <section className="fk-learning-last fk-v102-activity" aria-labelledby="fk-v102-last-title">
     <div className="fk-learning-section-head"><h3 id="fk-v102-last-title">نشاطاتك الأخيرة</h3><Clock3 size={19}/></div>
     {recent.length&&!isPreview?<div className="fk-v102-activity-list">{recent.map((r,i)=>{const l=lessons.find(x=>x.id===r.target);return <button type="button" key={String(r.id||i)} onClick={()=>r.kind==='progress'&&l?go('courses'):go('exams')}>
      {r.kind==='progress'?<PlayCircle size={18}/>:<ClipboardCheck size={18}/>}
      <span>{r.kind==='progress'?String(l?.title||'محاضرة'):'محاولة اختبار محفوظة'}</span><ChevronLeft size={15}/>
     </button>})}</div>:<p>من تكمل أول محاضرة أو اختبار، تظهر نشاطاتك المحفوظة هنا بشكل تلقائي.</p>}
   </section>
   {notice&&<div className="fk-v102-notice" role="status"><Sparkles size={18}/><span>{notice}</span><button type="button" aria-label="إغلاق التنبيه" onClick={()=>setNotice('')}>×</button></div>}
 </div>;
}
