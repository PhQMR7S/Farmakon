/* Pure, side-effect-free helpers. Shared by the real student page and unit tests. */
export function chooseGreeting(previous:number,count:number,randomValue:number):number{
 if(!Number.isInteger(count)||count<1)return 0;
 const last=Number.isInteger(previous)&&previous>=0&&previous<count?previous:-1;
 const alternatives=Array.from({length:count},(_,i)=>i).filter(i=>i!==last);
 if(alternatives.length===0)return 0;
 const safe=Number.isFinite(randomValue)?Math.max(0,Math.min(.999999999,randomValue)):0;
 return alternatives[Math.floor(safe*alternatives.length)];
}
export function greetingForHour(hour:number):string{
 if(!Number.isInteger(hour)||hour<0||hour>23)return 'أهلاً بك';
 return hour>=5&&hour<12?'صباح الخير':hour>=12&&hour<17?'نهارك سعيد':hour>=17&&hour<23?'مساء الخير':'أهلاً بك';
}
export function formatResumeTime(seconds:number):string{
 const safe=Math.max(0,Math.floor(Number.isFinite(seconds)?seconds:0));
 const minutes=Math.floor(safe/60);
 return minutes>=60?`${Math.floor(minutes/60)} س و${minutes%60} د`:`${minutes} دقيقة`;
}
export function getResumeSeconds(progressSeconds:unknown,minutes:unknown):number{
 const duration=Number(minutes);
 const max=Number.isFinite(duration)&&duration>0?Math.min(duration*60,86400):86400;
 const value=Number(progressSeconds);
 return Math.max(0,Math.min(Number.isFinite(value)?value:0,max));
}
export function safeLastTimestamp(row:{updated?:unknown;created?:unknown}):number{
 const value=Number(row.updated??row.created??0);
 return Number.isFinite(value)?value:0;
}
