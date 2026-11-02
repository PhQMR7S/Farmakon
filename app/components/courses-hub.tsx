'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,BookOpen,BookOpenCheck,Check,CheckCircle2,ChevronLeft,Clock3,Compass,FlaskConical,GraduationCap,Heart,LockKeyhole,PlayCircle,Search,SlidersHorizontal,Sparkles,TimerReset,TrendingUp,X} from 'lucide-react';
import {courseMatches,coursePublishedLessons,durationLabel,getCourseEntitlement,getCourseProgress,type CourseRecord} from './courses-logic';
import {getCoursesCopy,type CourseLocale} from './courses-i18n';

export type CoursesHubProps={
 courses:CourseRecord[];lessons:CourseRecord[];enrollments:CourseRecord[];activity:CourseRecord[];
 userId?:string;locale?:CourseLocale;isPreview?:boolean;
 onOpenCourse:(course:CourseRecord)=>void;
 onResumeLesson?:(lesson:CourseRecord,course:CourseRecord)=>void;
 /** When provided, favorites are stored by authenticated user on the server. */
 onToggleFavorite?:(courseId:string,saved:boolean)=>Promise<void>;
};
type Mode='mine'|'explore';
type SortOrder='recent'|'name'|'progress'|'duration';
const color=(v:unknown)=>['blue','purple','amber','teal'].includes(String(v))?String(v):'blue';
const safeCover=(v:unknown)=>{const url=typeof v==='string'?v.trim():'';return (/^https:\/\/[a-z0-9.-]+(?:\/|$)/i.test(url)||(/^\/(?!\/)/.test(url)&&!url.includes('\\')))?url:null};

export default function CoursesHub({
 courses,lessons,enrollments,activity,userId='preview',locale='ar',isPreview=false,onOpenCourse,onResumeLesson,onToggleFavorite
}:CoursesHubProps){
 const t=getCoursesCopy(locale),en=locale==='en';
 const [mode,setMode]=useState<Mode>('mine');
 const [query,setQuery]=useState('');
 const [stage,setStage]=useState('all');
 const [category,setCategory]=useState('all');
 const [pricing,setPricing]=useState('all');
 const [mineFilter,setMineFilter]=useState('all');
 const [sort,setSort]=useState<SortOrder>('recent');
 const [onlyFavorites,setOnlyFavorites]=useState(false);
 const [filterOpen,setFilterOpen]=useState(false);
 const [favorites,setFavorites]=useState<string[]>([]);
 const [favoriteReady,setFavoriteReady]=useState(false);
 const [pendingFavorites,setPendingFavorites]=useState<string[]>([]);
 const [notice,setNotice]=useState('');
 const dialogRef=useRef<HTMLDivElement>(null);
 const filterButtonRef=useRef<HTMLButtonElement>(null);
 const favKey='fk-v1031-favorites:'+userId;
 const serverFavorites=!!onToggleFavorite;
 useEffect(()=>{
   if(serverFavorites){
     const records=activity.filter(a=>a.kind==='course_favorite'&&a.target);
     const saved=records.filter(a=>a.data?.saved===true).map(a=>String(a.target));
     setFavorites([...new Set(saved)]);setFavoriteReady(true);return;
   }
   try{const data=JSON.parse(localStorage.getItem(favKey)||'[]');setFavorites(Array.isArray(data)?data.filter((x:unknown):x is string=>typeof x==='string').slice(0,300):[])}
   catch{setFavorites([])}
   setFavoriteReady(true);
 },[serverFavorites,activity,favKey]);
 useEffect(()=>{
   if(!filterOpen)return;
   const old=document.body.style.overflow,previous=document.activeElement as HTMLElement|null;
   document.body.style.overflow='hidden';
   const focusId=requestAnimationFrame(()=>dialogRef.current?.querySelector<HTMLElement>('button[data-close]')?.focus({preventScroll:true}));
   const onKey=(e:KeyboardEvent)=>{
     if(e.key==='Escape'){e.preventDefault();setFilterOpen(false);return}
     if(e.key!=='Tab'||!dialogRef.current)return;
     const controls=Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled),select:not(:disabled),input:not(:disabled)'));
     if(!controls.length)return;
     if(e.shiftKey&&document.activeElement===controls[0]){e.preventDefault();controls[controls.length-1].focus()}
     else if(!e.shiftKey&&document.activeElement===controls[controls.length-1]){e.preventDefault();controls[0].focus()}
   };
   document.addEventListener('keydown',onKey);
   return()=>{cancelAnimationFrame(focusId);document.removeEventListener('keydown',onKey);document.body.style.overflow=old;previous?.focus({preventScroll:true})};
 },[filterOpen]);
 async function toggleFavorite(id:string){
   if(pendingFavorites.includes(id))return;
   const wasSaved=favorites.includes(id),saved=!wasSaved;
   const next=wasSaved?favorites.filter(v=>v!==id):[...favorites,id];
   setFavorites(next);
   setNotice(saved?t.saved:t.removed);
   if(!onToggleFavorite){
     try{localStorage.setItem(favKey,JSON.stringify(next))}catch{setNotice(t.localFavoritesError)}
     return;
   }
   setPendingFavorites(current=>[...current,id]);
   try{await onToggleFavorite(id,saved)}
   catch{setFavorites(current=>saved?current.filter(v=>v!==id):[...current,id]);setNotice(t.syncFavoritesError)}
   finally{setPendingFavorites(current=>current.filter(v=>v!==id))}
 }
 const list=useMemo(()=>courses.filter(c=>c.status==='published'),[courses]);
 const now=Date.now();
 const enriched=useMemo(()=>list.map(c=>({
   course:c,access:getCourseEntitlement(c.id,enrollments,now),
   progress:getCourseProgress(c.id,lessons,activity),
   publishedLessons:coursePublishedLessons(c.id,lessons)
 })),[list,enrollments,lessons,activity,now]);
 const my=enriched.filter(x=>x.access.active);
 const lastResume=[...my].filter(x=>x.progress.nextLesson).sort((a,b)=>b.progress.lastActivity-a.progress.lastActivity)[0]??null;
 const totalDone=my.reduce((count,item)=>count+item.progress.done,0);
 const totalLessons=my.reduce((count,item)=>count+item.progress.total,0);
 const overallPercent=totalLessons?Math.round(100*totalDone/totalLessons):0;
 const completedCourses=my.filter(item=>item.progress.percent===100).length;
 const stages=[...new Set(list.map(c=>String(c.stage||'')).filter(Boolean))].sort((a,b)=>a.localeCompare(b,locale));
 const categories=[...new Set(list.map(c=>String(c.category||'')).filter(Boolean))].sort((a,b)=>a.localeCompare(b,locale));
 const matching=enriched.filter(item=>{
   const c=item.course;
   if(mode==='mine'&&!item.access.active&&!(mineFilter==='expired'&&item.access.expired))return false;
   if(mode==='mine'&&mineFilter==='ongoing'&&(!item.access.active||item.progress.percent===100))return false;
   if(mode==='mine'&&mineFilter==='completed'&&(!item.access.active||item.progress.percent!==100))return false;
   if(mode==='mine'&&mineFilter==='expired'&&!item.access.expired)return false;
   if(!courseMatches(c,query))return false;
   if(stage!=='all'&&c.stage!==stage)return false;
   if(category!=='all'&&c.category!==category)return false;
   if(mode==='explore'&&pricing==='free'&&(Number(c.price)||0)!==0)return false;
   if(mode==='explore'&&pricing==='paid'&&(Number(c.price)||0)===0)return false;
   if(onlyFavorites&&!favorites.includes(String(c.id)))return false;
   return true;
 }).sort((a,b)=>{
   if(sort==='name')return String(a.course.title||'').localeCompare(String(b.course.title||''),locale);
   if(sort==='progress')return (b.progress.percent??-1)-(a.progress.percent??-1);
   if(sort==='duration')return b.publishedLessons.reduce((n,l)=>n+(Number(l.minutes)||0),0)-a.publishedLessons.reduce((n,l)=>n+(Number(l.minutes)||0),0);
   return b.progress.lastActivity-a.progress.lastActivity||((Number(b.course.updated)||0)-(Number(a.course.updated)||0))||String(a.course.title).localeCompare(String(b.course.title),'ar');
 });
 const countActive=[stage,category,sort].filter((v,i)=>v!==(i===2?'recent':'all')).length
  +(mode==='mine'?(mineFilter!=='all'?1:0):(pricing!=='all'?1:0))+(onlyFavorites?1:0);
 const hasFilters=!!query||countActive>0;
 function clearFilters(){setQuery('');setStage('all');setCategory('all');setPricing('all');setMineFilter('all');setOnlyFavorites(false);setSort('recent')}
 function switchMode(value:Mode){setMode(value);clearFilters()}
 const fmtPrice=(v:unknown)=>new Intl.NumberFormat(en?'en-IQ':'ar-IQ').format(Math.max(0,Number(v)||0))+(en?' IQD':' د.ع');
 const fmtDate=(value:number)=>new Date(value).toLocaleDateString(en?'en-GB':'ar-IQ',{day:'numeric',month:'short',year:'numeric'});
 const fmtNumber=(value:number)=>new Intl.NumberFormat(en?'en-US':'ar-IQ').format(value);
 const duration=(v:number)=>en?(v>=60?Math.floor(v/60)+' h '+(v%60?v%60+' min':''):v+' min'):durationLabel(v);
 const open=(c:CourseRecord)=>onOpenCourse(c);
 const resume=(c:CourseRecord,l:CourseRecord|null)=>{
   if(!l||!onResumeLesson){open(c);return}
   onResumeLesson(l,c);
 };
 const cover=(c:CourseRecord)=>safeCover(c.coverUrl||c.cover||c.image);
 const card=(item:typeof enriched[number])=>{
   const c=item.course,access=item.access,p=item.progress;
   const starred=favorites.includes(String(c.id)),active=access.active;
   const published=item.publishedLessons;
   const mins=published.reduce((sum,l)=>sum+Math.max(0,Number(l.minutes)||0),0);
   const theme=color(c.color),coverUrl=cover(c),tag=String(c.category||t.pharmacy);
   return <article className="fk-courses-card fk-course-polished-card" key={c.id}>
     <div className={'fk-courses-cover fk-courses-'+theme+(coverUrl?' has-image':'')}>
       {coverUrl&&<img src={coverUrl} alt="" className="fk-courses-cover-img" loading="lazy" decoding="async" referrerPolicy="no-referrer"/>}
       <span className="fk-courses-cover-tag">{tag}</span>
       {!coverUrl&&<div className="fk-courses-cover-symbol" aria-hidden="true"><FlaskConical size={65} strokeWidth={1.3}/><span/><span/></div>}
       <span className="fk-courses-cover-wordmark">FARMAKON / {String(c.category)==='التدريب الصيفي'?'PRACTICE':'LEARNING'}</span>
       <button type="button" disabled={pendingFavorites.includes(String(c.id))}
        className={'fk-courses-favorite '+(starred?'is-on':'')} aria-label={starred?t.bookmarkRemove:t.bookmarkAdd}
        aria-pressed={starred} onClick={()=>void toggleFavorite(String(c.id))}>
        <Heart size={20} fill={starred?'currentColor':'none'}/>
       </button>
     </div>
     <div className="fk-courses-card-content">
       <div className="fk-courses-card-top"><span>{c.stage||t.allYears}</span>
         <span className={'fk-courses-access '+(active?'is-active':access.expired?'is-expired':'')}>{active?t.active:access.expired?t.expiredAccess:(Number(c.price)||0)===0?t.freeCourse:t.available}</span>
       </div>
       <h3>{c.title}</h3>
       <p>{c.description||t.courseInfo}</p>
       <div className="fk-courses-meta"><span><BookOpen size={16}/>{fmtNumber(published.length)} {t.lecture}</span><span><Clock3 size={16}/>{duration(mins)}</span></div>
       {active&&<div className="fk-courses-card-progress">
         <div className="fk-courses-progress-label"><span>{p.percent===null?t.notPublished:t.yourProgress}</span><b>{p.percent===null?'—':fmtNumber(p.percent)+'%'}</b></div>
         <div className="fk-courses-meter" role="progressbar" aria-label={String(c.title)+' · '+t.yourProgress} aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.percent??0}><span style={{width:(p.percent??0)+'%'}}/></div>
         <small>{fmtNumber(p.done)} / {fmtNumber(p.total)} {t.lessonsCompleted}</small>
       </div>}
       {access.expires&&active&&<small className="fk-courses-expiry"><TimerReset size={14}/>{t.availableUntil} {fmtDate(access.expires)}</small>}
       <div className="fk-courses-card-footer">
         <strong>{active?t.included:(Number(c.price)||0)===0?t.freeCourse:fmtPrice(c.price)}</strong>
         <button type="button" className="fk-courses-card-open" onClick={()=>open(c)} aria-label={t.openCourse+' '+String(c.title)}>
          {active?t.continueCourse:t.courseDetails}<ChevronLeft size={18} className={en?'fk-ltr-chevron':''}/>
         </button>
       </div>
     </div>
   </article>;
 };
 return <section className="fk-courses-v1031 fk-courses-polish" aria-labelledby="fk-courses-heading" dir={en?'ltr':'rtl'} lang={locale}>
   {isPreview&&<div className="fk-courses-demo-note" role="status"><Sparkles size={18}/><span><b>{t.demoTitle}</b> — {t.demoNote}</span></div>}
   <div className="fk-courses-hero">
     <div className="fk-courses-hero-copy"><span className="fk-courses-kicker">{t.heroEyebrow}</span>
       <h1 id="fk-courses-heading">{t.heroTitle}</h1><p>{t.heroDescription}</p>
       <button type="button" className="fk-courses-primary" onClick={()=>switchMode('explore')}><Compass size={18}/>{t.heroAction}<ArrowLeft size={16} className={en?'fk-ltr-chevron':''}/></button>
     </div>
     <div className="fk-courses-hero-art" aria-hidden="true"><div className="fk-courses-hero-orbit"><BookOpen size={79} strokeWidth={1.25}/></div>
       <div className="fk-courses-hero-mini a"><GraduationCap size={23}/></div><div className="fk-courses-hero-mini b"><FlaskConical size={21}/></div>
     </div>
   </div>
   <div className="fk-courses-snapshot" aria-label={t.yourProgress}>
     <div><span className="fk-courses-stat-icon cyan"><BookOpenCheck size={21}/></span><small>{t.activeCourses}</small><strong>{fmtNumber(my.length)}</strong></div>
     <div><span className="fk-courses-stat-ring" role="img" aria-label={t.yourProgress+' '+fmtNumber(overallPercent)+'%'} style={{background:'conic-gradient(#55c9ff '+overallPercent+'%,rgba(93,161,218,.17) 0)'}}><span><CheckCircle2 size={19}/></span></span><small>{t.completedLessons}</small><strong>{fmtNumber(totalDone)}</strong></div>
     <div><span className="fk-courses-stat-icon rose"><TrendingUp size={20}/></span><small>{t.completedCourses}</small><strong>{fmtNumber(completedCourses)}</strong></div>
   </div>
   {mode==='mine'&&<div className="fk-courses-resume">
     <div className="fk-courses-resume-icon"><PlayCircle size={27}/></div>
     <div className="fk-courses-resume-info"><span>{t.resume}</span><strong>{lastResume?lastResume.progress.nextLesson?.title:t.startJourney}</strong><small>{lastResume?lastResume.course.title:t.discoverHint}</small></div>
     <button type="button" onClick={()=>lastResume?resume(lastResume.course,lastResume.progress.nextLesson):switchMode('explore')} aria-label={lastResume?t.continue:t.discover}>
       {lastResume?t.continue:t.discover}<ChevronLeft size={19} className={en?'fk-ltr-chevron':''}/>
     </button>
   </div>}
   <div className="fk-courses-section-bar"><div><span className="fk-courses-kicker">YOUR COURSE LIBRARY</span><h2>{t.library}</h2></div><span className="fk-courses-library-hint">{t.libraryHint}</span></div>
   <div className="fk-courses-switch" role="group" aria-label={t.courseType}>
     <button type="button" aria-pressed={mode==='mine'} className={mode==='mine'?'active':''} onClick={()=>switchMode('mine')}><BookOpenCheck size={19}/>{t.myCourses}<span>{fmtNumber(my.length)}</span></button>
     <button type="button" aria-pressed={mode==='explore'} className={mode==='explore'?'active':''} onClick={()=>switchMode('explore')}><Compass size={19}/>{t.explore}<span>{fmtNumber(list.length)}</span></button>
   </div>
   <div className="fk-courses-search-panel">
     <div className="fk-courses-search-row">
       <label className="fk-courses-search"><Search size={20}/><span className="sr-only">{t.searchHint}</span><input type="search" autoComplete="off" value={query} onChange={e=>setQuery(e.target.value)} placeholder={t.search} aria-label={t.search}/>{query&&<button type="button" aria-label={t.clearSearch} onClick={()=>setQuery('')}><X size={18}/></button>}</label>
       <button type="button" ref={filterButtonRef} className="fk-courses-filter-trigger" onClick={()=>setFilterOpen(true)} aria-label={t.filtersOpen} aria-haspopup="dialog" aria-expanded={filterOpen}><SlidersHorizontal size={19}/><span>{t.filters}</span>{countActive>0&&<span className="fk-courses-filter-badge">{fmtNumber(countActive)}</span>}</button>
     </div>
     <div className="fk-courses-chips" aria-label={t.filterResults}>
       {mode==='mine'?[['all',t.all],['ongoing',t.ongoing],['completed',t.completed],['expired',t.expired]].map(([v,label])=><button type="button" key={v} className={mineFilter===v?'active':''} aria-pressed={mineFilter===v} onClick={()=>setMineFilter(v)}>{label}</button>)
        :[['all',t.allCourses],['free',t.free],['paid',t.paid]].map(([v,label])=><button type="button" key={v} className={pricing===v?'active':''} aria-pressed={pricing===v} onClick={()=>setPricing(v)}>{label}</button>)}
       <button type="button" className={onlyFavorites?'active fk-courses-fav-filter':'fk-courses-fav-filter'} aria-pressed={onlyFavorites} onClick={()=>setOnlyFavorites(v=>!v)}><Heart size={16} fill={onlyFavorites?'currentColor':'none'}/>{t.favorites}</button>
     </div>
   </div>
   <div className="fk-courses-results-head"><span><b>{fmtNumber(matching.length)}</b> {mode==='mine'?t.ofMyCourses:t.coursesAvailable}</span>{hasFilters&&<button type="button" onClick={clearFilters}>{t.clearFilters}<X size={15}/></button>}</div>
   {matching.length?<div className="fk-courses-cards">{matching.map(card)}</div>:
     <div className="fk-courses-empty"><span><BookOpen size={36}/></span><h3>{mode==='mine'&&!hasFilters?t.noEnrolled:t.noResults}</h3><p>{mode==='mine'&&!hasFilters?t.noEnrolledHelp:t.noResultsHelp}</p><button type="button" onClick={()=>mode==='mine'&&!hasFilters?switchMode('explore'):clearFilters()}>{mode==='mine'&&!hasFilters?t.explore:t.clearFilters}<ArrowLeft size={17}/></button></div>
   }
   {favoriteReady&&notice&&<div className="fk-courses-inline-notice" role="status">{notice}<button type="button" onClick={()=>setNotice('')} aria-label={t.close}><X size={15}/></button></div>}
   <p className="fk-courses-footnote"><LockKeyhole size={15}/>{t.privateFavorites}</p>
   {filterOpen&&<>
     <div className="fk-courses-filter-shade" onClick={()=>setFilterOpen(false)} aria-hidden="true"/>
     <div role="dialog" aria-modal="true" aria-labelledby="fk-courses-filter-title" className="fk-courses-filter-sheet" ref={dialogRef} dir={en?'ltr':'rtl'}>
       <div className="fk-courses-filter-grab" aria-hidden="true"/>
       <div className="fk-courses-filter-head">
         <div><h3 id="fk-courses-filter-title">{t.filterTitle}</h3><p>{t.filterHint}</p></div>
         <button type="button" data-close aria-label={t.close} onClick={()=>setFilterOpen(false)}><X size={22}/></button>
       </div>
       <div className="fk-courses-filter-body">
         <label><span><GraduationCap size={18}/>{t.filterStage}</span><select value={stage} onChange={e=>setStage(e.target.value)}><option value="all">{t.allStages}</option>{stages.map(value=><option value={value} key={value}>{value}</option>)}</select></label>
         <label><span><BookOpen size={18}/>{t.filterCategory}</span><select value={category} onChange={e=>setCategory(e.target.value)}><option value="all">{t.allCategories}</option>{categories.map(value=><option value={value} key={value}>{value}</option>)}</select></label>
         <label><span><TrendingUp size={18}/>{t.sort}</span><select value={sort} onChange={e=>setSort(e.target.value as SortOrder)}><option value="recent">{t.sortRecent}</option><option value="name">{t.sortName}</option><option value="progress">{t.sortProgress}</option><option value="duration">{t.sortDuration}</option></select></label>
         {mode==='explore'&&<label><span><SlidersHorizontal size={18}/>{t.filterPrice}</span><select value={pricing} onChange={e=>setPricing(e.target.value)}><option value="all">{t.allCourses}</option><option value="free">{t.free}</option><option value="paid">{t.paid}</option></select></label>}
         <button type="button" className={'fk-courses-filter-fav '+(onlyFavorites?'is-active':'')} aria-pressed={onlyFavorites} onClick={()=>setOnlyFavorites(v=>!v)}><Heart size={19} fill={onlyFavorites?'currentColor':'none'}/>{t.favorites}<span>{onlyFavorites&&<Check size={18}/>}</span></button>
       </div>
       <div className="fk-courses-filter-actions">
         <button type="button" onClick={clearFilters} className="fk-courses-filter-clear">{t.clearFilters}</button>
         <button type="button" onClick={()=>setFilterOpen(false)} className="fk-courses-filter-apply">{t.filterResults} · {fmtNumber(matching.length)} <Check size={19}/></button>
       </div>
     </div>
   </>}
 </section>;
}
