import {database} from '../../database';
import type {DeletionJob,DeletionStore} from './deletion';
// Serializes workers using a durable lease. A crashed worker must be known stopped
// before an operator clears its lease; never automatically steal a running lease.
export function deletionStore(db=database):DeletionStore{
 const lease=crypto.randomUUID();
 return {
  async claim(id){return db.prepare("UPDATE farmakon.deletion_jobs SET lease=?,attempts=attempts+1,updated=? WHERE user_id=? AND lease IS NULL AND state<>'complete' RETURNING user_id,email,state,attempts").bind(lease,Date.now(),id).first<DeletionJob>();},
  async advance(id,from,to){const r=await db.prepare('UPDATE farmakon.deletion_jobs SET state=?,updated=? WHERE user_id=? AND state=? AND lease=?').bind(to,Date.now(),id,from,lease).run();if(r.meta.changes!==1)throw Error('DELETION_LEASE');},
  async release(id){await db.prepare('UPDATE farmakon.deletion_jobs SET lease=NULL,updated=? WHERE user_id=? AND lease=?').bind(Date.now(),id,lease).run();},
  async purge(id,email){await db.transaction(async()=>{
   // Unknown record ownership and shared attachments require manual review.
   const unsafe=await db.prepare("SELECT id FROM records WHERE (data::jsonb->>'userId'=? OR data::jsonb->>'owner'=?) AND kind NOT IN ('attempt','ticket','order','asset') LIMIT 1").bind(id,id).first();
   const assets=await db.prepare("SELECT id FROM records WHERE kind='asset' AND data::jsonb->>'owner'=? LIMIT 1").bind(id).first();
   if(unsafe||assets)throw Error('DELETION_MANUAL_REVIEW');
   // synthetic-v1 deletes synthetic financial/security rows only. This is NOT
   // a production retention policy; no default deletion of real financial data.
   await db.prepare("DELETE FROM records WHERE kind IN ('attempt','ticket','order') AND data::jsonb->>'userId'=?").bind(id).run();
   await db.prepare("DELETE FROM records WHERE kind='audit' AND data::jsonb->>'user'=?").bind(email).run();
   await db.prepare('DELETE FROM activity WHERE user_id=?').bind(id).run();
   await db.prepare('DELETE FROM enrollments WHERE lower(email)=?').bind(email.toLowerCase()).run();
   // Never reset used_by to NULL: that would make a consumed code redeemable.
   await db.prepare('UPDATE codes SET used_by=? WHERE lower(used_by)=?').bind('deleted:'+id,email.toLowerCase()).run();
   await db.prepare('DELETE FROM members WHERE id=?').bind(id).run();
  });}
 };
}
