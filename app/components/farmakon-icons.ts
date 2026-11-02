/**
 * Farmakon V10.3.1 icon system: semantically consistent, Lucide-based,
 * rounded line icons for controls and softly dimensional "glass" containers for features.
 *
 * These are original combinations of licensed icon primitives, not SF Symbols.
 * No external assets, emoji glyphs or device-specific fonts required.
 */
import type {LucideIcon} from 'lucide-react';
import {
  Bell,BookMarked,BookOpen,BookOpenCheck,BookOpenText,BriefcaseMedical,
  CheckCircle2,ChevronLeft,ClipboardCheck,ClipboardList,Clock3,Compass,
  Dna,Ellipsis,FlaskConical,GraduationCap,Heart,HeartPulse,House,
  Library,Menu,Microscope,Pill,PlayCircle,Search,Settings2,
  ShieldCheck,SlidersHorizontal,Sparkles,Stethoscope,TimerReset,
  TrendingUp,UserRound,Wallet
} from 'lucide-react';

export const FARM_ICON_STROKE=1.95;
export const farmIcons={
 home:House,
 courses:BookOpenCheck,
 learning:GraduationCap,
 library:Library,
 more:Ellipsis,
 menu:Menu,
 search:Search,
 notifications:Bell,
 account:UserRound,
 filters:SlidersHorizontal,
 explore:Compass,
 favorites:Heart,
 lessonCount:BookOpenText,
 duration:Clock3,
 resume:PlayCircle,
 activeSubscription:ShieldCheck,
 completedLessons:CheckCircle2,
 completedCourses:ClipboardCheck,
 progress:TrendingUp,
 expiry:TimerReset,
 courseDetails:ChevronLeft,
 studentProfile:UserRound,
 academic:GraduationCap,
 bank:ClipboardList,
 studyLibrary:BookMarked,
 subscription:Wallet,
 settings:Settings2,
 smart:Sparkles,
 generalCourse:BookOpen,
 practice:BriefcaseMedical,
 pharmacology:Pill,
 clinical:Stethoscope,
 microbiology:Microscope,
 therapeutics:HeartPulse,
 anatomy:Dna,
 chemistry:FlaskConical
} as const satisfies Record<string,LucideIcon>;

export type FarmIconName=keyof typeof farmIcons;
export type CourseIconKind='practice'|'pharmacology'|'clinical'|'microbiology'|'therapeutics'|'anatomy'|'chemistry'|'generalCourse';

/** Match real category/title semantics without inventing a field in the database. */
export function courseIconKind(category:unknown,title:unknown):CourseIconKind {
 const words=String(category??'')+' '+String(title??'');
 const text=words.toLowerCase().normalize('NFKC')
   .replace(/[\u064B-\u065F\u0670\u0640]/g,'')
   .replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه');
 if(/التدريب|practice|training|internship|summer|تطبيق عملي/.test(text))return 'practice';
 if(/microb|bacter|virol|mycol|مجهري|احياء مجهري|بكتير|فايروس/.test(text))return 'microbiology';
 if(/clinical|سريري|سريريه|pharmacy practice|صيدله سريريه/.test(text))return 'clinical';
 if(/therapeut|علاج|medicine therapy/.test(text))return 'therapeutics';
 if(/anatom|physiol|تشريح|فسلج|فسيولوج/.test(text))return 'anatomy';
 if(/pharmaco|علم الادويه|دوائي|ادويه|pharmacodynamics|pharmacokinetics/.test(text))return 'pharmacology';
 if(/chem|كيمياء|كيميا|تحليل كيميائي/.test(text))return 'chemistry';
 return 'generalCourse';
}

/** Optional themed classes are selected from this finite map to avoid arbitrary injected CSS. */
export const farmIconTone:Record<CourseIconKind,'cyan'|'violet'|'teal'|'coral'|'amber'>={
 practice:'cyan',pharmacology:'violet',clinical:'teal',
 microbiology:'violet',therapeutics:'coral',anatomy:'coral',
 chemistry:'amber',generalCourse:'cyan'
};
