// Non-secret identity of the existing isolated project, deliberately pinned.
// Changing Staging providers requires reviewing this allowlist and its tests.
const STAGING_REF='qfzharpouemueipsrduv';
export function assertPreviewIsolation(env:Record<string,string|undefined>=process.env){
 if(env.VERCEL_ENV!=='preview')return;
 const deny=()=>{throw new Error('PREVIEW_ISOLATION_REQUIRED');};
 try{
  const api=new URL(env.NEXT_PUBLIC_SUPABASE_URL||'');
  const db=new URL(env.DATABASE_URL||'');
  const direct=db.hostname===`db.${STAGING_REF}.supabase.co`;
  const pooled=/^aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(db.hostname)&&decodeURIComponent(db.username).endsWith(`.${STAGING_REF}`);
  if(api.origin!==`https://${STAGING_REF}.supabase.co`||api.username||api.password||api.search||api.hash||!['','/'].includes(api.pathname))deny();
  if(!['postgres:','postgresql:'].includes(db.protocol)||(!direct&&!pooled)||!db.username||!db.password||db.pathname!=='/postgres'||db.search||db.hash||!['','5432','6543'].includes(db.port))deny();
  if(!env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||env.FARMAKON_STRICT_SESSIONS_ENABLED!=='true'||env.FARMAKON_RATE_LIMIT_ENABLED!=='true'||(env.FARMAKON_RATE_LIMIT_SECRET?.length||0)<32)deny();
 }catch{deny();}
}
