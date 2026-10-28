// Synthetic test tooling only. No provider connection, SQL execution or disk extraction.
import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';
const aad=Buffer.from('farmakon-dr-envelope-v1');
export const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=()=>{throw Error('DR_BACKUP_REJECTED');};
const exact=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function seal(payload,key){
 if(!Buffer.isBuffer(key)||key.length!==32)fail();
 const nonce=randomBytes(12),c=createCipheriv('aes-256-gcm',key,nonce);c.setAAD(aad);
 return Buffer.concat([nonce,c.update(Buffer.from(JSON.stringify(payload))),c.final(),c.getAuthTag()]);
}
export function openAndValidate(encrypted,key,expected){
 try{
  if(!Buffer.isBuffer(encrypted)||encrypted.length<29||encrypted.length>16*1024*1024||!Buffer.isBuffer(key)||key.length!==32)fail();
  const d=createDecipheriv('aes-256-gcm',key,encrypted.subarray(0,12));d.setAAD(aad);d.setAuthTag(encrypted.subarray(-16));
  const payload=JSON.parse(Buffer.concat([d.update(encrypted.subarray(12,-16)),d.final()]).toString('utf8'));
  const m=payload.manifest;
  // Expected inventory/version is supplied independently, never inferred from the archive.
  if(!m||m.version!==1||m.scope!=='synthetic-only'||m.snapshotId!==expected.snapshotId||m.schemaVersion!==expected.schemaVersion||!exact(m.migrations,expected.migrations))fail();
  if(!Array.isArray(m.files)||!payload.files||typeof payload.files!=='object'||Array.isArray(payload.files))fail();
  const names=m.files.map(f=>f.path);
  if(new Set(names).size!==names.length||!exact([...names].sort(),[...expected.paths].sort())||!exact(Object.keys(payload.files).sort(),[...expected.paths].sort()))fail();
  const result=new Map();
  for(const f of m.files){
   if(typeof f.path!=='string'||!f.path||f.path.length>200||f.path.startsWith('/')||f.path.split('/').some(p=>!p||p==='.'||p==='..')||/[^a-zA-Z0-9_.\/-]/.test(f.path))fail();
   const encoded=payload.files[f.path];if(typeof encoded!=='string')fail();
   const bytes=Buffer.from(encoded,'base64');
   if(bytes.toString('base64')!==encoded||!Number.isSafeInteger(f.size)||f.size<0||f.size!==bytes.length||!/^[a-f0-9]{64}$/.test(f.sha256)||digest(bytes)!==f.sha256)fail();
   result.set(f.path,bytes);
  }
  return result;
 }catch{fail();} // Fixed message: no dump contents, paths, secrets or provider errors.
}
