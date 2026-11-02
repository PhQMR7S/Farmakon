import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import CoursesPreview from './courses-client';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Farmakon | كورساتي واستكشف الكورسات — V10.3.1',description:'معاينة تفاعلية لصفحتي كورساتي واستكشف الكورسات بالهوية المعتمدة — بيانات توضيحية فقط',robots:{index:false,follow:false}};
export default function Page(){
 if(process.env.VERCEL_ENV!=='preview'||process.env.FARMAKON_PREVIEW_READ_ONLY!=='1')notFound();
 return <CoursesPreview/>;
}
