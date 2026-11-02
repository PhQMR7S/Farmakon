'use client';
import {useMemo,useState} from 'react';
import {ArrowRight,BookOpenCheck,CalendarDays,CheckCircle2,ChevronDown,ChevronLeft,Clock3,FileText,LockKeyhole,PlayCircle,ShieldCheck,Ticket,Layers3,GraduationCap} from 'lucide-react';
import {courseOutline,courseDetailsState,canOpenCourseLesson} from './course-details-logic';
import {courseIconKind,farmIconTone,farmIcons,FARM_ICON_STROKE} from './farmakon-icons';
import {durationLabel,type CourseRecord} from './courses-logic';
import type {CourseLocale} from './courses-i18n';

export type CourseDetailsProps={
 course:CourseRecord;lessons:CourseRecord[];enrollments:CourseRecord[];orders?:CourseRecord[];
 locale?:CourseLocale;isPreview?:boolean;onBack:()=>void;onOpenLesson:(lesson:CourseRecord)=>void;
 onRequestSubscription?:()=>void;onRedeemCode?:()=>void;
};
const translations={
 ar:{
  back:'العودة إلى الكورسات',overview:'نظرة عامة',curriculum:'المنهج والمحاضرات',contents:'محتوى الكورس',
  published:'محاضرة منشورة',modules:'وحدة',duration:'مدة المحاضرات',stage:'المرحلة',subject:'المادة',
  description:'عن هذا الكورس',noDescription:'يمكنك تصفح الوحدات والمحاضرات المنشورة لهذا الكورس.',
  open:'فتح المحاضرة',locked:'تتطلب اشتراكاً فعّالاً',freeLesson:'محاضرة مجانية',courseIncluded:'اشتراك فعّال',
  pending:'طلب الاشتراك قيد المراجعة',expired:'انتهى اشتراكك',available:'متاح للاشتراك',free:'كورس مجاني',
  until:'متاح حتى',days:'مدة الاشتراك',daysSuffix:'يوم',price:'السعر',included:'ضمن اشتراكك',
  noLessons:'لم تُنشر محاضرات لهذا الكورس بعد.',preview:'معاينة التصميم فقط — لا تشغيل فيديو أو اشتراكات حقيقية.',
  request:'طلب الاشتراك',redeem:'تفعيل بواسطة كود',openNext:'متابعة أول محاضرة متاحة',
  pendingHelp:'طلبك موجود لدى إدارة المنصة. لا تحتاج لإعادة إرسال طلب قبل مراجعته.',
  expiredHelp:'تحتاج إلى تجديد اشتراكك للوصول إلى المحاضرات المحمية.',
  noAccessHelp:'يمكنك فتح المحاضرات المجانية المعلنة أو تفعيل الاشتراك الخاص بك.',
  freeHelp:'مجانية الكورس لا تعني فتح الملفات المحمية تلقائياً؛ تعتمد الإتاحة على تفعيل الإدارة أو المحاضرات المجانية.',
  noLessonAccess:'لا توجد محاضرات يمكنك فتحها حالياً.',noAutomaticCharge:'لا توجد عملية دفع تلقائي من هذه الصفحة.',
  unavailable:'غير متاح في المعاينة',count:'محاضرات',more:'عرض الوحدة',less:'طي الوحدة'
 },
 en:{
  back:'Back to courses',overview:'Overview',curriculum:'Syllabus & lectures',contents:'Course content',
  published:'published lectures',modules:'modules',duration:'Lecture duration',stage:'Stage',subject:'Subject',
  description:'About the course',noDescription:'Explore the published course units and lectures.',
  open:'Open lecture',locked:'Active subscription required',freeLesson:'Free lecture',courseIncluded:'Active subscription',
  pending:'Subscription request pending',expired:'Subscription expired',available:'Enrollment available',free:'Free course',
  until:'Available until',days:'Access period',daysSuffix:'days',price:'Price',included:'Included in your subscription',
  noLessons:'No published lectures in this course yet.',preview:'Design preview only — no video playback or real subscriptions.',
  request:'Request enrollment',redeem:'Activate with a code',openNext:'Open next available lecture',
  pendingHelp:'Your request is awaiting review. No need to submit another request.',
  expiredHelp:'Renew your subscription to access protected lectures.',
  noAccessHelp:'You may open free lessons or activate your course access.',
  freeHelp:'A free course does not automatically unlock protected files. Access depends on activation or free lessons.',
  noLessonAccess:'No lessons are currently accessible to your account.',noAutomaticCharge:'No automatic payment is taken here.',
  unavailable:'Unavailable in preview',count:'lectures',more:'Expand module',less:'Collapse module'
 }
} as const;

export default function CourseDetails({
 course,lessons,enrollments,orders=[],locale='ar',isPreview=false,onBack,onOpenLesson,onRequestSubscription,onRedeemCode
}:CourseDetailsProps){
 const en=locale==='en',t=translations[locale];
 const [tab,setTab]=useState<'overview'|'curriculum'>('overview');
 const modules=useMemo(()=>courseOutline(course.id,lessons),[course.id,lessons]);
 const [collapsed,setCollapsed]=useState<string[]>([]);
 const state=courseDetailsState(course,enrollments,orders);
 const visible=modules.flatMap(m=>m.lessons);
 const accessible=visible.filter(canOpenCourseLesson);
 const minutes=visible.reduce((sum,l)=>sum+Math.max(0,Number(l.minutes)||0),0);
 const courseType=courseIconKind(course.category,course.title),CoverIcon=farmIcons[courseType],tone=farmIconTone[courseType];
 const cover=typeof course.coverUrl==='string'&&/^https:\/\/[a-z0-9.-]+(?:\/|$)/i.test(course.coverUrl)?course.coverUrl:null;
 const number=(n:number)=>new Intl.NumberFormat(en?'en-US':'ar-IQ').format(n);
 const price=number(state.price)+(en?' IQD':' د.ع');
 const endDate=state.expires?new Date(state.expires).toLocaleDateString(en?'en-GB':'ar-IQ',{year:'numeric',month:'long',day:'numeric'}):'';
 const statusLabel=state.active?t.courseIncluded:state.pending?t.pending:state.expired?t.expired:state.free?t.free:t.available;
 const lockedCount=visible.length-accessible.length;
 const [firstLesson]=accessible;
 const showLesson=(lesson:CourseRecord)=>{if(canOpenCourseLesson(lesson))onOpenLesson(lesson);};
 return <section className="fk-course-details" dir={en?'ltr':'rtl'} lang={locale} aria-labelledby="fk-detail-title">
   <button type="button" className="fk-detail-back" onClick={onBack}><ArrowRight size={19} className={en?'fk-ltr-chevron':''}/>{t.back}</button>
   {isPreview&&<div className="fk-detail-preview-note" role="status"><ShieldCheck size={19}/>{t.preview}</div>}
   <header className="fk-detail-hero">
    <div className="fk-detail-hero-copy">
     <span className="fk-detail-eyebrow">FARMAKON / COURSE DETAILS</span>
     <div className="fk-detail-tags"><span>{String(course.stage||'')}</span><span>{String(course.category||'')}</span></div>
     <h1 id="fk-detail-title">{String(course.title||'')}</h1>
     <p>{String(course.description||t.noDescription)}</p>
     <div className="fk-detail-hero-meta">
      <span><Layers3 size={17}/>{number(modules.length)} {t.modules}</span>
      <span><BookOpenCheck size={17}/>{number(visible.length)} {t.published}</span>
      <span><Clock3 size={17}/>{durationLabel(minutes)}</span>
     </div>
    </div>
    <div className="fk-detail-art" aria-hidden="true">
     {cover?<img src={cover} alt="" loading="lazy" referrerPolicy="no-referrer"/>:<div className={'fk-course-discipline-icon fk-course-tone-'+tone}><CoverIcon size={82} strokeWidth={1.7}/></div>}
    </div>
   </header>
   <div className="fk-detail-grid">
    <div className="fk-detail-main">
     <nav className="fk-detail-tabs" role="tablist" aria-label={t.contents}>
      <button type="button" role="tab" id="fk-detail-tab-overview" aria-controls="fk-detail-panel" aria-selected={tab==='overview'} className={tab==='overview'?'active':''} onClick={()=>setTab('overview')}>{t.overview}</button>
      <button type="button" role="tab" id="fk-detail-tab-curriculum" aria-controls="fk-detail-panel" aria-selected={tab==='curriculum'} className={tab==='curriculum'?'active':''} onClick={()=>setTab('curriculum')}>{t.curriculum}</button>
     </nav>
     <div className="fk-detail-surface" id="fk-detail-panel" role="tabpanel" aria-labelledby={tab==='overview'?'fk-detail-tab-overview':'fk-detail-tab-curriculum'}>
      {tab==='overview'?<>
       <h2><FileText size={21}/>{t.description}</h2>
       <p className="fk-detail-description">{String(course.description||t.noDescription)}</p>
       <div className="fk-detail-facts">
        <div><GraduationCap size={18}/><span>{t.stage}</span><strong>{String(course.stage||'—')}</strong></div>
        <div><BookOpenCheck size={18}/><span>{t.subject}</span><strong>{String(course.category||'—')}</strong></div>
        <div><Layers3 size={18}/><span>{t.contents}</span><strong>{number(modules.length)} {t.modules} · {number(visible.length)} {t.count}</strong></div>
        <div><Clock3 size={18}/><span>{t.duration}</span><strong>{durationLabel(minutes)}</strong></div>
       </div>
       {firstLesson?<button className="fk-detail-primary" type="button" onClick={()=>showLesson(firstLesson)}><PlayCircle size={19}/>{t.openNext}<ChevronLeft className={en?'fk-ltr-chevron':''} size={18}/></button>:<p className="fk-detail-empty">{visible.length?t.noLessonAccess:t.noLessons}</p>}
      </>:<>
       <h2><Layers3 size={21}/>{t.curriculum}</h2>
       {modules.length?modules.map(m=>{
        const closed=collapsed.includes(m.id);
        return <section className="fk-detail-module" key={m.id}>
         <button className="fk-detail-module-head" type="button" aria-expanded={!closed} onClick={()=>setCollapsed(old=>closed?old.filter(v=>v!==m.id):[...old,m.id])}>
          <span><strong>{m.title}</strong><small>{number(m.lessons.length)} {t.count}</small></span>
          <ChevronDown className={closed?'is-closed':''} size={20}/>
         </button>
         {!closed&&<div className="fk-detail-lesson-list">{m.lessons.map((l,i)=>{
          const allowed=canOpenCourseLesson(l);
          return <div className={'fk-detail-lesson '+(allowed?'':'is-locked')} key={String(l.id)}>
           <span className="fk-detail-lesson-number">{allowed?<PlayCircle size={19}/>:<LockKeyhole size={18}/>}</span>
           <div className="fk-detail-lesson-copy"><strong>{String(l.title||'')}</strong><small>{number(Math.max(0,Number(l.minutes)||0))} {en?'min':'دقيقة'}{l.free&&allowed?' · '+t.freeLesson:''}</small></div>
           {allowed?<button type="button" className="fk-detail-open" onClick={()=>showLesson(l)} aria-label={t.open+' '+String(l.title||'')}>{t.open}<ChevronLeft className={en?'fk-ltr-chevron':''} size={16}/></button>:<span className="fk-detail-locked-label"><LockKeyhole size={14}/>{t.locked}</span>}
          </div>;
         })}</div>}
        </section>;
       }):<p className="fk-detail-empty">{t.noLessons}</p>}
      </>}
     </div>
    </div>
    <aside className="fk-detail-aside">
     <div className="fk-detail-subscription">
      <span className={'fk-detail-state '+(state.active?'is-active':state.pending?'is-pending':state.expired?'is-expired':'')}>{state.active?<CheckCircle2 size={17}/>:<ShieldCheck size={17}/>} {statusLabel}</span>
      <div className="fk-detail-price"><span>{t.price}</span><strong>{state.free?t.free:price}</strong></div>
      <div className="fk-detail-aside-row"><CalendarDays size={18}/><span>{state.active&&endDate?t.until:t.days}</span><b>{state.active&&endDate?endDate:number(Number(course.days)||0)+' '+t.daysSuffix}</b></div>
      {state.active?<p className="fk-detail-help"><CheckCircle2 size={17}/>{t.included}</p>:
       <p className="fk-detail-help">{state.pending?t.pendingHelp:state.expired?t.expiredHelp:state.free?t.freeHelp:t.noAccessHelp}</p>}
      {!isPreview&&!state.active&&!state.pending&&onRequestSubscription&&!state.free&&<button type="button" className="fk-detail-primary" onClick={onRequestSubscription}><Ticket size={19}/>{t.request}</button>}
      {!isPreview&&!state.active&&onRedeemCode&&<button type="button" className="fk-detail-secondary" onClick={onRedeemCode}><Ticket size={17}/>{t.redeem}</button>}
      {isPreview&&<small className="fk-detail-help">{t.unavailable}</small>}
      <small className="fk-detail-subnote">{t.noAutomaticCharge}{lockedCount>0?' · '+number(lockedCount)+' '+t.locked:''}</small>
     </div>
    </aside>
   </div>
 </section>;
}
