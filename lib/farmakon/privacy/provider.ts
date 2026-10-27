import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {database} from '../../database';
import {deletionEnabled,assertDisposable} from './gate';
import {deletionStore} from './store';
import {resumeDeletion,type DeletionProvider} from './deletion';
// Trusted operator entry point only: never expose this as an unauthenticated
// cron/HTTP endpoint. Secret stays in a dedicated Staging worker, not Preview.
export async function runSyntheticDeletion(userId:string){
 if(!deletionEnabled()||!process.env.FARMAKON_STAGING_DELETION_SECRET)throw Error('DELETION_DISABLED');
 const job=await database.prepare("SELECT user_id,email,state FROM farmakon.deletion_jobs WHERE user_id=? AND policy='synthetic-v1'").bind(userId).first<{user_id:string,email:string,state:string}>();
 if(!job)throw Error('DELETION_JOB_REQUIRED');
 const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.FARMAKON_STAGING_DELETION_SECRET,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 let missing=false;
 const provider:DeletionProvider={
  async assertFixture(id,email){
   const {data,error}=await admin.auth.admin.getUserById(id);
   if(error){if(error.status===404&&job.state==='data_removed'){missing=true;return;}throw Error('DELETION_PROVIDER_UNAVAILABLE');}
   assertDisposable(data.user,process.env.FARMAKON_OWNER_EMAIL);
   if(data.user.email!==email)throw Error('DELETION_SCOPE');
  },
  async revokeSessions(id){
   // Ban prevents new password logins while a failed job awaits resumption.
   const {error}=await admin.auth.admin.updateUserById(id,{ban_duration:'876000h'});if(error)throw Error('DELETION_BAN_FAILED');
   await database.prepare('SELECT farmakon.revoke_synthetic_sessions(?)').bind(id).first();
  },
  async removePrivateFiles(id){
   // Includes orphans in storage.objects, not only asset records. SQL helper
   // refuses shared/course assets before returning any paths.
   const paths=(await database.prepare('SELECT * FROM farmakon.synthetic_owned_files(?)').bind(id).all<{name:string}>()).results;
   for(let i=0;i<paths.length;i+=100){const {error}=await admin.storage.from('farmakon').remove(paths.slice(i,i+100).map(p=>p.name));if(error)throw Error('DELETION_STORAGE_FAILED');}
   const remaining=(await database.prepare('SELECT * FROM farmakon.synthetic_owned_files(?)').bind(id).all()).results;
   if(remaining.length)throw Error('DELETION_STORAGE_INCOMPLETE');
   await database.prepare("DELETE FROM records WHERE kind='asset' AND data::jsonb->>'owner'=?").bind(id).run();
  },
  async deleteAuth(id){if(missing)return;const {error}=await admin.auth.admin.deleteUser(id,false);if(error&&error.status!==404)throw Error('DELETION_AUTH_FAILED');}
 };
 return resumeDeletion(deletionStore(),provider,userId);
}
