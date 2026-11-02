import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import LearningDesignPreview from './learning-client';

export const dynamic='force-dynamic';
export const metadata:Metadata={
 title:'Farmakon | مركز التعلّم V10.2 — المعاينة النهائية',
 description:'التصميم المتوازن المعتمد لمركز التعلّم — بيانات توضيحية فقط',
 robots:{index:false,follow:false}
};

export default function Page(){
 // No login bypass: the route only exists on read-only Vercel previews.
 // The client shows predeclared illustration data, never queries account or APIs.
 if(process.env.VERCEL_ENV!=='preview'||process.env.FARMAKON_PREVIEW_READ_ONLY!=='1')notFound();
 return <LearningDesignPreview/>;
}
