import type { Metadata, Viewport } from 'next';
import './globals.css';
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#101935'};
export const metadata:Metadata={title:'Farmakon | كورسات الصيدلة',description:'كورساتك ومحاضراتك واختباراتك في مكان واحد.',manifest:'/manifest.webmanifest?v=3',appleWebApp:{capable:true,title:'Farmakon',statusBarStyle:'default'},icons:{icon:[{url:'/favicon-32-v3.png',sizes:'32x32',type:'image/png'}],apple:[{url:'/apple-touch-icon-v3.png',sizes:'180x180',type:'image/png'}]}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="ar" dir="rtl"><body>{children}</body></html>}
