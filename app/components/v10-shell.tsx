'use client';
import {useEffect,useRef,useState} from 'react';
import {BookOpen,House,GraduationCap,Library,Menu,Search,ClipboardList,Users,Ticket,Layers,Wallet,ShieldCheck,Download,LifeBuoy,Settings,Sun,Moon,X,ChevronLeft,PlayCircle} from 'lucide-react';

export type ShellPanel='search'|'learning'|'more'|null;
export type SearchResult={id:string;title:string;kind:string;section:string;course?:Record<string,any>};

export function MobileNavigation({page,adminMode,onNavigate,onOpen}:{page:string;adminMode:boolean;onNavigate:(p:string)=>void;onOpen:(v:ShellPanel)=>void}){
 const tabs=adminMode
 ?[{id:'dashboard',label:'الرئيسية',icon:House},{id:'content',label:'المحتوى',icon:Layers},{id:'codes',label:'الأكواد',icon:Ticket},{id:'students',label:'الطلاب',icon:Users}]
 :[{id:'dashboard',label:'الرئيسية',icon:House},{id:'courses',label:'كورساتي',icon:BookOpen},{id:'learning',label:'التعلّم',icon:GraduationCap},{id:'library',label:'المكتبة',icon:Library}];
 const active=(id:string)=>id==='learning'?['questions','exams'].includes(page):id===page;
 return <nav className="mobile-dock fk-dock" aria-label="التنقل الرئيسي">
   {tabs.map(t=>{const Icon=t.icon;return <button key={t.id} type="button" className={active(t.id)?'active':''} aria-current={active(t.id)?'page':undefined} aria-label={t.label} onClick={()=>t.id==='learning'?onOpen('learning'):onNavigate(t.id)}>
    <Icon size={21} strokeWidth={1.9}/><span>{t.label}</span>
   </button>})}
   <button type="button" aria-label="المزيد من الأقسام والخدمات" onClick={()=>onOpen('more')}><Menu size={21} strokeWidth={1.9}/><span>المزيد</span></button>
 </nav>
}
const moreLinks=[
 {id:'account',label:'حسابي',icon:ShieldCheck,description:'البيانات الشخصية والأمان'},
 {id:'subscriptions',label:'اشتراكاتي',icon:Wallet,description:'الكورسات المفعلة وصلاحيات الوصول'},
 {id:'downloads',label:'التنزيلات',icon:Download,description:'الملفات المحفوظة'},
 {id:'support',label:'المساعدة والدعم',icon:LifeBuoy,description:'التواصل والحصول على المساعدة'},
];
const learningLinks=[
 {id:'courses',label:'المحاضرات والكورسات',icon:PlayCircle,description:'الوحدات ومتابعة المحاضرات'},
 {id:'questions',label:'بنك الأسئلة',icon:ClipboardList,description:'أسئلة التدريب والمراجعة'},
 {id:'exams',label:'الاختبارات',icon:GraduationCap,description:'اختبر معلوماتك وتابع نتائجك'}
];
export function ShellLayers({panel,onClose,onNavigate,searchItems,theme,onTheme,onInstall,adminMode,onSidebar}:{panel:ShellPanel;onClose:()=>void;onNavigate:(p:string,c?:Record<string,any>)=>void;searchItems:SearchResult[];theme:string;onTheme:()=>void;onInstall:()=>void;adminMode:boolean;onSidebar:()=>void}){
 const [q,setQ]=useState('');
 const dialog=useRef<HTMLDivElement|null>(null);
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
 const norm=q.trim().toLocaleLowerCase('ar');
 const found=!norm?[]:searchItems.filter(v=>v.title.toLocaleLowerCase('ar').includes(norm)||v.kind.toLocaleLowerCase('ar').includes(norm)).slice(0,18);
 const showMore=panel==='more',showLearning=panel==='learning';
 return <div className="fk-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
   <div className={panel==='search'?'fk-dialog fk-search-dialog':'fk-dialog fk-sheet'} role="dialog" aria-modal="true" aria-labelledby="fk-dialog-title" ref={dialog}>
    <div className="fk-sheet-handle" aria-hidden="true"/>
    <div className="fk-dialog-head"><h2 id="fk-dialog-title">{panel==='search'?'البحث في Farmakon':showLearning?'مركز التعلّم':'المزيد من الخدمات'}</h2><button type="button" className="fk-action" onClick={onClose} aria-label="إغلاق النافذة"><X size={21}/></button></div>
    {panel==='search'?<>
      <label className="fk-search-field"><Search size={20}/><span className="sr-only">ابحث في الكورسات والمكتبة</span><input value={q} onChange={e=>setQ(e.target.value)} placeholder="ابحث في الكورسات والمكتبة…" autoComplete="off" dir="auto"/></label>
      <div className="fk-search-results" aria-live="polite">
       {norm? found.length?found.map(r=><button type="button" key={r.id} className="fk-result" onClick={()=>go(r.section,r.course)}><div><strong>{r.title}</strong><small>{r.kind}</small></div><ChevronLeft size={18}/></button>):<p className="fk-empty-note">ما لقينا نتيجة في المحتوى المتاح لك. جرّب كلمات ثانية.</p>:<p className="fk-empty-note"><Search size={22}/>اكتب عنوان كورس أو اسم ملف للبحث في المحتوى المتاح.</p>}
      </div>
     </>:<>
      <div className="fk-sheet-links">{(showLearning?learningLinks:moreLinks).map(item=>{const Icon=item.icon;return <button key={item.id} type="button" className="fk-sheet-link" onClick={()=>go(item.id)}><span className="fk-sheet-icon"><Icon size={21}/></span><span className="fk-sheet-copy"><strong>{item.label}</strong><small>{item.description}</small></span><ChevronLeft size={18}/></button>})}
       {showMore&&<><button className="fk-sheet-link" type="button" onClick={()=>{onClose();onTheme()}}><span className="fk-sheet-icon">{theme==='dark'?<Sun size={21}/>:<Moon size={21}/>}</span><span className="fk-sheet-copy"><strong>المظهر</strong><small>التبديل بين الوضع الفاتح والداكن</small></span><ChevronLeft size={18}/></button>
       <button className="fk-sheet-link" type="button" onClick={()=>{onClose();onInstall()}}><span className="fk-sheet-icon"><Download size={21}/></span><span className="fk-sheet-copy"><strong>تثبيت المنصة</strong><small>إضافة Farmakon إلى الشاشة الرئيسية</small></span><ChevronLeft size={18}/></button>
       {adminMode&&<button className="fk-sheet-link" type="button" onClick={()=>{onClose();onSidebar()}}><span className="fk-sheet-icon"><Settings size={21}/></span><span className="fk-sheet-copy"><strong>إدارة الأكاديمية</strong><small>عرض كل أقسام لوحة المالك</small></span><ChevronLeft size={18}/></button>}</>}
      </div>
     </>}
   </div>
  </div>;
}
