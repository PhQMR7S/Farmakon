'use client';
import {useEffect,useRef,useState} from 'react';
import {BookOpen,House,GraduationCap,Library,Menu,Search,Bell,UserRound,ClipboardList,Users,Ticket,Layers,Wallet,ShieldCheck,Download,LifeBuoy,Settings,Sun,Moon,X,ChevronLeft,PlayCircle} from 'lucide-react';
import {farmIcons,FARM_ICON_STROKE} from './farmakon-icons';
import {matchesNormalizedQuery,normalizeCourseText} from './courses-logic';

export type ShellPanel='search'|'learning'|'more'|'notifications'|null;
export type ShellAnnouncement={id:string;title:string;description?:string;date?:string};
export type SearchResult={id:string;title:string;kind:string;section:string;course?:Record<string,any>};

export function FarmakonHeader({title,onMenu,onSearch,onNotifications,onMore,onToggleSidebar,menuOpen=false}:{title:string;onMenu:()=>void;onSearch:()=>void;onNotifications:()=>void;onMore:()=>void;onToggleSidebar:()=>void;menuOpen?:boolean}){
 return <header className="topbar fk-topbar fk-header-v2">
  <div className="fk-header-identity">
   <button type="button" className="icon-btn mobile-menu fk-nav-trigger" aria-label="فتح القائمة" aria-expanded={menuOpen} onClick={onMenu}><farmIcons.menu size={22} strokeWidth={FARM_ICON_STROKE}/></button>
   <button type="button" className="icon-btn fk-desktop-expand fk-nav-trigger" aria-label="طي أو توسيع القائمة" onClick={onToggleSidebar}><farmIcons.menu size={22} strokeWidth={FARM_ICON_STROKE}/></button>
   <img className="fk-header-logo" src="/farmakon-logo.jpg" alt="" width={40} height={40}/>
   <span className="fk-header-brand"><strong>Farmakon</strong><small>{title}</small></span>
  </div>
  <div className="fk-header-actions">
   <button type="button" className="fk-header-action" aria-label="البحث في Farmakon" title="البحث" onClick={onSearch}><farmIcons.search size={22} strokeWidth={FARM_ICON_STROKE}/></button>
   <button type="button" className="fk-header-action" aria-label="إعلانات الأكاديمية" title="الإعلانات" onClick={onNotifications}><farmIcons.notifications size={22} strokeWidth={FARM_ICON_STROKE}/></button>
   <button type="button" className="fk-header-profile" aria-label="الحساب والخدمات" title="الحساب والخدمات" onClick={onMore}><farmIcons.account size={22} strokeWidth={FARM_ICON_STROKE}/></button>
  </div>
 </header>;
}

export function MobileNavigation({page,adminMode,onNavigate,onOpen,panel=null,learningAsPage=false}:{page:string;adminMode:boolean;onNavigate:(p:string)=>void;onOpen:(v:ShellPanel)=>void;panel?:ShellPanel;learningAsPage?:boolean}){
 const tabs=adminMode
 ?[{id:'dashboard',label:'الرئيسية',icon:farmIcons.home},{id:'content',label:'المحتوى',icon:Layers},{id:'codes',label:'الأكواد',icon:Ticket},{id:'students',label:'الطلاب',icon:Users}]
 :[{id:'dashboard',label:'الرئيسية',icon:farmIcons.home},{id:'courses',label:'كورساتي',icon:farmIcons.courses},{id:'learning',label:'التعلّم',icon:farmIcons.learning},{id:'library',label:'المكتبة',icon:farmIcons.library}];
 const inMore=['account','subscriptions','downloads','support','settings','announcements','reports','payments'];
 const active=(id:string)=>id==='learning'?(learningAsPage?page==='learning'&&!panel:(panel==='learning'||(!panel&&['questions','exams'].includes(page)))):id==='more'?(panel==='more'||(!panel&&inMore.includes(page))):id===page&&!panel;
 const items=[...tabs,{id:'more',label:'المزيد',icon:farmIcons.more}];
 const activeIndex=items.findIndex(i=>active(i.id));
 return <nav className="mobile-dock fk-dock fk-dock-v2" aria-label="أقسام Farmakon" style={{'--fk-tab-index':activeIndex} as React.CSSProperties}>
    {activeIndex>=0&&<span className="fk-dock-active-indicator" aria-hidden="true"/>}
    {items.map(t=>{const Icon=t.icon;return <button type="button" key={t.id} className={'fk-dock-item '+(active(t.id)?'active':'')} aria-current={active(t.id)?'page':undefined} aria-label={t.label} onClick={()=>t.id==='more'?onOpen('more'):t.id==='learning'&&!learningAsPage?onOpen('learning'):onNavigate(t.id)}>
      <span className="fk-dock-glyph"><Icon size={23} strokeWidth={active(t.id)?2.3:FARM_ICON_STROKE}/></span><span className="fk-dock-caption">{t.label}</span>
    </button>})}
   </nav>;
}
const moreLinks=[
 {id:'account',label:'حسابي',icon:farmIcons.account,description:'البيانات الشخصية والأمان'},
 {id:'subscriptions',label:'اشتراكاتي',icon:farmIcons.subscription,description:'الكورسات المفعلة وصلاحيات الوصول'},
 {id:'downloads',label:'التنزيلات',icon:Download,description:'الملفات المحفوظة'},
 {id:'support',label:'المساعدة والدعم',icon:LifeBuoy,description:'التواصل والحصول على المساعدة'},
];
const learningLinks=[
 {id:'courses',label:'المحاضرات والكورسات',icon:farmIcons.courses,description:'الوحدات ومتابعة المحاضرات'},
 {id:'questions',label:'بنك الأسئلة',icon:farmIcons.bank,description:'أسئلة التدريب والمراجعة'},
 {id:'exams',label:'الاختبارات',icon:farmIcons.academic,description:'اختبر معلوماتك وتابع نتائجك'}
];
export function ShellLayers({panel,onClose,onNavigate,searchItems,theme,onTheme,onInstall,adminMode,onSidebar,announcements=[]}:{panel:ShellPanel;onClose:()=>void;onNavigate:(p:string,c?:Record<string,any>)=>void;searchItems:SearchResult[];theme:string;onTheme:()=>void;onInstall:()=>void;adminMode:boolean;onSidebar:()=>void;announcements?:ShellAnnouncement[]}){
 const [q,setQ]=useState('');
 const dialog=useRef<HTMLDivElement|null>(null);
 const dragStart=useRef(0);
 useEffect(()=>{if(!panel)return;setQ('');const old=document.body.style.overflow;document.body.style.overflow='hidden';const previous=document.activeElement as HTMLElement|null;
 const focus=()=>dialog.current?.querySelector<HTMLElement>('input,button:not(:disabled)')?.focus();
 const raf=requestAnimationFrame(focus);
 const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();onClose();return}if(e.key!=='Tab'||!dialog.current)return;
 const items=Array.from(dialog.current.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),a[href]'));if(!items.length)return;const first=items[0],last=items[items.length-1];
 if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}};
 document.addEventListener('keydown',onKey);
 return()=>{cancelAnimationFrame(raf);document.removeEventListener('keydown',onKey);document.body.style.overflow=old;previous?.focus()}},[panel]);
 if(!panel)return null;
 const go=(id:string,course?:Record<string,any>)=>{onClose();onNavigate(id,course)};
 const norm=normalizeCourseText(q);
 const found=!norm?[]:searchItems.filter(v=>matchesNormalizedQuery([v.title,v.kind].join(' '),q)).slice(0,18);
 const showMore=panel==='more',showLearning=panel==='learning',showAnnouncements=panel==='notifications';
 return <div className="fk-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
   <div className={panel==='search'?'fk-dialog fk-search-dialog':'fk-dialog fk-sheet'} role="dialog" aria-modal="true" aria-labelledby="fk-dialog-title" ref={dialog}>
    <div className="fk-sheet-swipe-zone" aria-label="اسحب للأسفل لإغلاق النافذة" onTouchStart={e=>{dragStart.current=e.touches[0].clientY}} onTouchEnd={e=>{if(e.changedTouches[0].clientY-dragStart.current>72)onClose()}}><div className="fk-sheet-handle" aria-hidden="true"/></div>
    <div className="fk-dialog-head"><h2 id="fk-dialog-title">{panel==='search'?'البحث في Farmakon':showLearning?'مركز التعلّم':showAnnouncements?'إعلانات الأكاديمية':'المزيد من الخدمات'}</h2><button type="button" className="fk-action" onClick={onClose} aria-label="إغلاق النافذة"><X size={21}/></button></div>
    {showAnnouncements?<div className="fk-announcement-list" aria-live="polite">{announcements.length?announcements.map(a=><article className="fk-notice-card" key={a.id}><strong>{a.title}</strong>{a.date&&<small>{a.date}</small>}{a.description&&<p>{a.description}</p>}</article>):<p className="fk-empty-note">لا توجد إعلانات منشورة حالياً.</p>}</div>:panel==='search'?<>
      <label className="fk-search-field"><Search size={20}/><span className="sr-only">ابحث في الكورسات والمكتبة</span><input value={q} onChange={e=>setQ(e.target.value)} placeholder="ابحث في الكورسات والمكتبة…" autoComplete="off" dir="auto"/></label>
      <div className="fk-search-results" aria-live="polite">
       {norm? found.length?found.map(r=><button type="button" key={r.id} className="fk-result" onClick={()=>go(r.section,r.course)}><div><strong>{r.title}</strong><small>{r.kind}</small></div><ChevronLeft size={18}/></button>):<p className="fk-empty-note">ما لقينا نتيجة في المحتوى المتاح لك. جرّب كلمات ثانية.</p>:<p className="fk-empty-note"><Search size={22}/>اكتب عنوان كورس أو اسم ملف للبحث في المحتوى المتاح.</p>}
      </div>
     </>:<>
      <div className="fk-sheet-links">{(showLearning?learningLinks:moreLinks).map(item=>{const Icon=item.icon;return <button key={item.id} type="button" className="fk-sheet-link" onClick={()=>go(item.id)}><span className="fk-sheet-icon"><Icon size={22} strokeWidth={FARM_ICON_STROKE}/></span><span className="fk-sheet-copy"><strong>{item.label}</strong><small>{item.description}</small></span><ChevronLeft size={18}/></button>})}
       {showMore&&<><button className="fk-sheet-link" type="button" onClick={()=>{onClose();onTheme()}}><span className="fk-sheet-icon">{theme==='dark'?<Sun size={21}/>:<Moon size={21}/>}</span><span className="fk-sheet-copy"><strong>المظهر</strong><small>التبديل بين الوضع الفاتح والداكن</small></span><ChevronLeft size={18}/></button>
       <button className="fk-sheet-link" type="button" onClick={()=>{onClose();onInstall()}}><span className="fk-sheet-icon"><Download size={21}/></span><span className="fk-sheet-copy"><strong>تثبيت المنصة</strong><small>إضافة Farmakon إلى الشاشة الرئيسية</small></span><ChevronLeft size={18}/></button>
       {adminMode&&<button className="fk-sheet-link" type="button" onClick={()=>{onClose();onSidebar()}}><span className="fk-sheet-icon"><Settings size={21}/></span><span className="fk-sheet-copy"><strong>إدارة الأكاديمية</strong><small>عرض كل أقسام لوحة المالك</small></span><ChevronLeft size={18}/></button>}</>}
      </div>
     </>}
   </div>
  </div>;
}
