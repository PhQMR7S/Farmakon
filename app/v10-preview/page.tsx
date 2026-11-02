import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import PreviewClient from './preview-client';

export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Farmakon V10.1 | معاينة تصميم التنقل',robots:{index:false,follow:false}};

export default function V10ShellPreview(){
 // Requires two independent preview-only gates. No Supabase, personal, student,
 // admin, course, or billing information is ever read by the demo.
 if(process.env.VERCEL_ENV!=='preview'||process.env.FARMAKON_PREVIEW_READ_ONLY!=='1')notFound();
 return <PreviewClient/>;
}
