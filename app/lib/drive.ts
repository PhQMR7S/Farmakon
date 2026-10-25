/** Normalize only trusted Drive file URLs; never embed arbitrary user origins. */
export function drivePreview(value:string):string|null {
  try {
    const u=new URL(value);
    if(u.protocol!=='https:'||u.hostname!=='drive.google.com')return null;
    const id=u.pathname.match(/^\/file\/d\/([A-Za-z0-9_-]+)(?:\/|$)/)?.[1]||(['/', '/open','/uc'].includes(u.pathname)?u.searchParams.get('id'):null);
    if(!id||!/^[A-Za-z0-9_-]+$/.test(id))return null;
    const out=new URL('https://drive.google.com/file/d/'+id+'/preview');
    const key=u.searchParams.get('resourcekey');if(key)out.searchParams.set('resourcekey',key);
    return out.href;
  }catch{return null;}
}
