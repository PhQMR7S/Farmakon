'use client';
import {useEffect,useMemo,useState} from 'react';
import {ArrowLeft,BookOpen,BookOpenCheck,CheckCircle2,ChevronLeft,Clock3,Compass,FlaskConical,GraduationCap,Heart,LockKeyhole,Play,PlayCircle,Search,SlidersHorizontal,Sparkles,TimerReset,TrendingUp,WalletCards,X} from 'lucide-react';
import {courseMatches,coursePublishedLessons,durationLabel,getCourseEntitlement,getCourseProgress,type CourseRecord} from './courses-logic';

export type CoursesHubProps={
 courses:CourseRecord[];lessons:CourseRecord[];enrollments:CourseRecord[];activity:CourseRecord[];
 userId?:string;isPreview?:boolean;
 onOpenCourse:(course:CourseRecord)=>void;
 onResumeLesson?:(lesson:CourseRecord,course:CourseRecord)=>void;
};
type Mode='mine'|'explore';
type Order='recent'|'name'|'progress'|'duration';
const formatPrice=(price:unknown)=>new Intl.NumberFormat('ar-IQ').format(Math.max(0,Number(price)||0))+' د.ع';
const cleanColor=(color:unknown)=>['blue','purple','amber','teal'].includes(String(color))?String(color):'blue';
function gentleDate(timestamp:number){if(!timestamp)return '';return new Date(timestamp).toLocaleDateString('ar-IQ',{month:'short',day:'numeric',year:'numeric'})}

export default function CoursesHub({courses,lessons,enrollments,activity,userId='preview',isPreview=false,onOpenCourse,onResumeLesson}:CoursesHubProps){
 const [mode,setMode]=useState<Mode>('mine');
 const [query,setQuery]=useState('');
 const [stage,setStage]=useState('all');
 const [category,setCategory]=useState('all');
 const [pricing,setPricing]=useState('all');
 const [mineFilter,setMineFilter]=useState('all');
 const [sort,setSort]=useState<Order>('recent');
 const [favorites,setFavorites]=useState<string[]>([]);
 const [onlyFavorites,setOnlyFavorites]=useState(false);
 const [notice,setNotice]=useState('');
 const [favoritesReady,setFavoritesReady]=useState(false);
 const favKey='fk-v1031-favorites:'+String(userId||'preview');
 useEffect(()=>{
   try{const v=JSON.parse(localStorage.getItem(favKey)||'[]');setFavorites(Array.isArray(v)?v.filter(x=>typeof x==='string').slice(0,300):[])}
   catch{setFavorites([])}
   setFavoritesReady(true);
 },[favKey]);
 function toggleFavorite(id:string){
   setFavorites(current=>{
     const next=current.includes(id)?current.filter(v=>v!==id):[...current,id];
     try{localStorage.setItem(favKey,JSON.stringify(next))}catch{setNotice('تعذّر حفظ المفضلة على هذا الجهاز.')}
     return next;
   });
 }
 const list=useMemo(()=>courses.filter(c=>c.status==='published'),[courses]);
 const now=Date.now();
 const enriched=useMemo(()=>list.map(c=>({
   course:c,access:getCourseEntitlement(c.id,enrollments,now),
   progress:getCourseProgress(c.id,lessons,activity),
   publishedLessons:coursePublishedLessons(c.id,lessons)
 })),[list,enrollments,lessons,activity,now]);
 const my=enriched.filter(c=>c.access.active);
 const expired=enriched.filter(c=>c.access.expired);
 const lastResume=my.filter(x=>x.progress.nextLesson).sort((a,b)=>b.progress.lastActivity-a.progress.lastActivity)[0]??null;
 const totalDone=my.reduce((n,c)=>n+c.progress.done,0);
 const completeCourses=my.filter(c=>c.progress.percent!==null&&c.progress.percent===100).length;
 const stages=[...new Set(list.map(c=>String(c.stage||'')).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
 const categories=[...new Set(list.map(c=>String(c.category||'')).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
 const matching=enriched.filter(x=>{
   const c=x.course;
   if(mode==='mine'&&!x.access.active&&!(mineFilter==='expired'&&x.access.expired))return false;
   if(mode==='mine'&&mineFilter==='ongoing'&&(!x.access.active||x.progress.percent===100))return false;
   if(mode==='mine'&&mineFilter==='completed'&&(!x.access.active||x.progress.percent!==100))return false;
   if(mode==='mine'&&mineFilter==='expired'&&!x.access.expired)return false;
   if(!courseMatches(c,query))return false;
   if(stage!=='all'&&c.stage!==stage)return false;
   if(category!=='all'&&c.category!==category)return false;
   if(mode==='explore'&&pricing==='free'&&(Number(c.price)||0)!==0)return false;
   if(mode==='explore'&&pricing==='paid'&&(Number(c.price)||0)===0)return false;
   if(onlyFavorites&&!favorites.includes(String(c.id)))return false;
   return true;
 }).sort((a,b)=>{
   if(sort==='name')return String(a.course.title||'').localeCompare(String(b.course.title||''),'ar');
   if(sort==='progress')return (b.progress.percent??-1)-(a.progress.percent??-1);
   if(sort==='duration')return b.publishedLessons.reduce((n,l)=>n+(Number(l.minutes)||0),0)-a.publishedLessons.reduce((n,l)=>n+(Number(l.minutes)||0),0);
   return b.progress.lastActivity-a.progress.lastActivity||((Number(b.course.updated)||0)-(Number(a.course.updated)||0))||String(a.course.title).localeCompare(String(b.course.title),'ar');
 });
 const hasFilters=!!query||stage!=='all'||category!=='all'||pricing!=='all'||onlyFavorites||mineFilter!=='all';
 function clearFilters(){setQuery('');setStage('all');setCategory('all');setPricing('all');setOnlyFavorites(false);setMineFilter('all');setSort('recent')}
 function switchMode(value:Mode){setMode(value);clearFilters()}
 const open=(item:CourseRecord)=>onOpenCourse(item);
 const start=(c:CourseRecord,lesson:CourseRecord|null)=>{
   if(!lesson){open(c);return}
   if(!onResumeLesson){open(c);return}
   onResumeLesson(lesson,c);
 };
 const card=(item:typeof enriched[number])=>{
   const c=item.course,access=item.access,p=item.progress;
   const isActive=access.active,starred=favorites.includes(String(c.id));
   const theme=cleanColor(c.color);
   const mins=item.publishedLessons.reduce((s,l)=>s+Math.max(0,Number(l.minutes)||0),0);
   const categoryText=String(c.category||'صيدلة');
   return <article className="fk-courses-card" key={c.id}>
     <div className={'fk-courses-cover fk-courses-'+theme}>
       <span className="fk-courses-cover-tag">{categoryText}</span>
       <div className="fk-courses-cover-symbol" aria-hidden="true"><FlaskConical size={65} strokeWidth={1.3}/><span/><span/></div>
       <span className="fk-courses-cover-wordmark">FARMAKON / {categoryText==='التدريب الصيفي'?'PRACTICE':'LEARNING'}</span>
       <button type="button" className={'fk-courses-favorite '+(starred?'is-on':'')} aria-label={starred?'إزالة من المفضلة':'إضافة إلى المفضلة'} aria-pressed={starred} onClick={()=>toggleFavorite(String(c.id))} title={starred?'إزالة من المفضلة':'حفظ في المفضلة'}><Heart size={19} fill={starred?'currentColor':'none'}/></button>
     </div>
     <div className="fk-courses-card-content">
       <div className="fk-courses-card-top"><span>{c.stage||'جميع المراحل'}</span>
         <span className={'fk-courses-access '+(isActive?'is-active':access.expired?'is-expired':'')}>{isActive?'اشتراك فعّال':access.expired?'اشتراك منتهٍ':(Number(c.price)||0)===0?'كورس مجاني':'متاح للاشتراك'}</span>
       </div>
       <h3>{c.title}</h3>
       <p>{c.description||'تعرّف على محاضرات الكورس ومنهجه ومحتواه التعليمي.'}</p>
       <div className="fk-courses-meta">
         <span><BookOpen size={15}/>{item.publishedLessons.length} محاضرة</span>
         <span><Clock3 size={15}/>{durationLabel(mins)}</span>
       </div>
       {isActive&&<div className="fk-courses-card-progress">
         <div className="fk-courses-progress-label"><span>{p.percent===null?'لم تُنشر محاضرات متاحة بعد':'تقدمك الدراسي'}</span><b>{p.percent===null?'—':p.percent+'%'}</b></div>
         <div className="fk-courses-meter" role="progressbar" aria-label={'تقدّم كورس '+String(c.title)} aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.percent??0}><span style={{width:(p.percent??0)+'%'}}/></div>
         <small>{p.done} من {p.total} محاضرات متاحة مكتملة</small>
       </div>}
       {access.expires&&isActive&&<small className="fk-courses-expiry"><TimerReset size={13}/>متاح حتى {gentleDate(access.expires)}</small>}
       <div className="fk-courses-card-footer">
         <strong>{isActive?'ضمن اشتراكك':(Number(c.price)||0)===0?'مجاني':formatPrice(c.price)}</strong>
         <button type="button" className="fk-courses-card-open" onClick={()=>open(c)} aria-label={'فتح تفاصيل كورس '+String(c.title)}>{isActive?'متابعة الكورس':'تفاصيل الكورس'} <ChevronLeft size={16}/></button>
       </div>
     </div>
   </article>;
 };
 return <section className="fk-courses-v1031" aria-labelledby="fk-courses-heading" dir="rtl">
   {isPreview&&<div className="fk-courses-demo-note" role="status"><Sparkles size={19}/><span><b>معاينة V10.3.1 التفاعلية</b> — الكورسات والاشتراكات والنسب هنا أمثلة للتصميم فقط. لا توجد عمليات شراء أو تسجيل أو حفظ تقدّم.</span></div>}
   <div className="fk-courses-hero">
     <div className="fk-courses-hero-copy"><span className="fk-courses-kicker">FARMAKON · COURSES CENTER</span>
       <h1 id="fk-courses-heading">مساحتك للكورسات،<br/><span>ودراستك بخطوات واضحة.</span></h1>
       <p>كورساتك وموادك في مكان واحد. اكتشف محتوى جديد، أو كمّل آخر محاضرة من وين وقفت.</p>
       <div className="fk-courses-hero-actions">
         <button type="button" className="fk-courses-primary" onClick={()=>switchMode('mine')}><BookOpenCheck size={19}/> كورساتي <ArrowLeft size={16}/></button>
         <button type="button" className="fk-courses-outline" onClick={()=>switchMode('explore')}><Compass size={19}/> استكشف الكورسات</button>
       </div>
     </div>
     <div className="fk-courses-hero-art" aria-hidden="true">
       <div className="fk-courses-hero-orbit"><BookOpen size={79} strokeWidth={1.25}/></div>
       <div className="fk-courses-hero-mini a"><GraduationCap size={23}/></div>
       <div className="fk-courses-hero-mini b"><FlaskConical size={21}/></div>
       <div className="fk-courses-hero-mini c"><Sparkles size={20}/></div>
     </div>
   </div>
   <div className="fk-courses-snapshot" aria-label="ملخص الدراسة">
     <div><span className="fk-courses-stat-icon cyan"><BookOpenCheck size={22}/></span><small>كورساتي الفعّالة</small><strong>{my.length}</strong></div>
     <div><span className="fk-courses-stat-icon lilac"><CheckCircle2 size={22}/></span><small>المحاضرات المكتملة</small><strong>{totalDone}</strong></div>
     <div><span className="fk-courses-stat-icon rose"><TrendingUp size={22}/></span><small>كورسات مكتملة</small><strong>{completeCourses}</strong></div>
   </div>
   {mode==='mine'&&<div className="fk-courses-resume">
     <div className="fk-courses-resume-icon"><PlayCircle size={28}/></div>
     <div className="fk-courses-resume-info"><span>كمّل من وين وقفت</span><strong>{lastResume?lastResume.progress.nextLesson?.title:'ابدأ رحلتك الدراسية'}</strong><small>{lastResume?lastResume.course.title:'استكشف الكورسات المتاحة واختر ما يناسبك.'}</small></div>
     <button type="button" onClick={()=>lastResume?start(lastResume.course,lastResume.progress.nextLesson):switchMode('explore')} aria-label={lastResume?'استكمال آخر محاضرة':'استكشف الكورسات'}>{lastResume?'استكمال':'اكتشف'} <ChevronLeft size={18}/></button>
   </div>}
   <div className="fk-courses-section-bar">
     <div><span className="fk-courses-kicker">YOUR COURSE LIBRARY</span><h2>مكتبة كورساتك</h2></div>
     <span className="fk-courses-library-hint">محتوى مرتب، وصول واضح</span>
   </div>
   <div className="fk-courses-switch" role="group" aria-label="نوع الكورسات">
     <button type="button" aria-pressed={mode==='mine'} className={mode==='mine'?'active':''} onClick={()=>switchMode('mine')}><BookOpenCheck size={19}/> كورساتي <span>{my.length}</span></button>
     <button type="button" aria-pressed={mode==='explore'} className={mode==='explore'?'active':''} onClick={()=>switchMode('explore')}><Compass size={19}/> استكشف الكورسات <span>{list.length}</span></button>
   </div>
   <div className="fk-courses-search-panel">
     <label className="fk-courses-search"><Search size={19}/><span className="sr-only">ابحث في الكورسات</span><input type="search" autoComplete="off" value={query} onChange={e=>setQuery(e.target.value)} placeholder="ابحث عن كورس، مادة، أو مرحلة…" />{query&&<button type="button" aria-label="مسح البحث" onClick={()=>setQuery('')}><X size={17}/></button>}</label>
     <div className="fk-courses-selects">
       <label><GraduationCap size={17}/><span className="sr-only">فلتر المرحلة</span><select value={stage} onChange={e=>setStage(e.target.value)} aria-label="تصفية حسب المرحلة"><option value="all">جميع المراحل</option>{stages.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
       <label><SlidersHorizontal size={17}/><span className="sr-only">فلتر المادة</span><select value={category} onChange={e=>setCategory(e.target.value)} aria-label="تصفية حسب المادة"><option value="all">جميع المواد</option>{categories.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
       <label><TrendingUp size={17}/><span className="sr-only">ترتيب النتائج</span><select value={sort} onChange={e=>setSort(e.target.value as Order)} aria-label="ترتيب النتائج"><option value="recent">الأحدث / آخر نشاط</option><option value="name">الاسم أ–ي</option><option value="progress">حسب التقدم</option><option value="duration">حسب المدة</option></select></label>
     </div>
     <div className="fk-courses-chips" aria-label="فلاتر سريعة">
       {mode==='mine'?[['all','الكل'],['ongoing','أتابع دراستها'],['completed','مكتملة'],['expired','منتهية']].map(([v,label])=><button type="button" key={v} className={mineFilter===v?'active':''} aria-pressed={mineFilter===v} onClick={()=>setMineFilter(v)}>{label}</button>)
        :[['all','جميع الكورسات'],['free','مجانية'],['paid','مدفوعة']].map(([v,label])=><button type="button" key={v} className={pricing===v?'active':''} aria-pressed={pricing===v} onClick={()=>setPricing(v)}>{label}</button>)}
       <button type="button" className={onlyFavorites?'active fk-courses-fav-filter':'fk-courses-fav-filter'} aria-pressed={onlyFavorites} onClick={()=>setOnlyFavorites(v=>!v)}><Heart size={15} fill={onlyFavorites?'currentColor':'none'}/> المفضلة</button>
     </div>
   </div>
   <div className="fk-courses-results-head"><span><b>{matching.length}</b> {mode==='mine'?'من كورساتك':'كورس متاح للاستكشاف'}</span>{hasFilters&&<button type="button" onClick={clearFilters}>مسح الفلاتر <X size={15}/></button>}</div>
   {matching.length?<div className="fk-courses-cards">{matching.map(card)}</div>:<div className="fk-courses-empty"><span><BookOpen size={36}/></span><h3>{mode==='mine'&&!hasFilters?'ما عندك كورسات فعّالة حالياً':'ما لقينا كورسات مطابقة'}</h3><p>{mode==='mine'&&!hasFilters?'ابدأ باستكشاف الكورسات واختر الكورس المناسب لدراستك.':'جرّب إزالة بعض الفلاتر أو غيّر كلمات البحث.'}</p><button type="button" onClick={()=>mode==='mine'&&!hasFilters?switchMode('explore'):clearFilters()}>{mode==='mine'&&!hasFilters?'استكشف الكورسات':'إزالة الفلاتر'} <ArrowLeft size={17}/></button></div>}
   {favoritesReady&&notice&&<div className="fk-courses-inline-notice" role="status">{notice}<button type="button" aria-label="إغلاق التنبيه" onClick={()=>setNotice('')}><X size={14}/></button></div>}
   <p className="fk-courses-footnote"><LockKeyhole size={14}/> المفضلة محفوظة على هذا الجهاز فقط. صلاحيات الاشتراك والتقدم تأتي من حسابك عند الاتصال.</p>
 </section>;
}
