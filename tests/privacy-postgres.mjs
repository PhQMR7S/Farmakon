import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {testDatabase} from './helpers/postgres.mjs';
const compile=s=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText).toString('base64');
const {db,close}=await testDatabase();
const pool=new Pool({connectionString:process.env.FARMAKON_TEST_DATABASE_URL,ssl:false});
const a='00000000-0000-4000-8000-000000000041',b='00000000-0000-4000-8000-000000000042',email='f004-delete-a@example.test';
try{
 await pool.query(`CREATE SCHEMA auth;CREATE SCHEMA storage;
 CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_app_meta_data jsonb);
 CREATE TABLE auth.sessions(id uuid,user_id uuid,not_after timestamptz);
 CREATE TABLE storage.objects(name text,bucket_id text,owner_id text);
 DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='farmakon_app') THEN CREATE ROLE farmakon_app NOLOGIN;END IF;END $$;
 GRANT USAGE ON SCHEMA farmakon TO farmakon_app;`);
 await pool.query(fs.readFileSync('scripts/staging/f004-synthetic-deletion.sql','utf8'));
 await pool.query("INSERT INTO farmakon.settings VALUES('storage-owner','{\"email\":\"owner@example.test\"}')");
 for(const [uid,mail] of [[a,email],[b,'f004-delete-b@example.test']]){
  await pool.query('INSERT INTO auth.users VALUES($1,$2,$3)',[uid,mail,{farmakon_test_fixture:true}]);
  await pool.query('INSERT INTO auth.sessions VALUES($1,$1,NULL)',[uid]);
  await db.prepare('INSERT INTO members VALUES(?,?,?,?)').bind(uid,mail,'fixture',0).run();
  await db.prepare('INSERT INTO enrollments VALUES(?,?,?,?,?)').bind(uid,mail,'course',Date.now()+60000,'synthetic').run();
  await db.prepare('INSERT INTO activity VALUES(?,?,?,?,?,?)').bind(uid,uid,'progress','lesson','{"note":"private"}',0).run();
  for(const kind of ['attempt','order','ticket'])await db.prepare('INSERT INTO records VALUES(?,?,?,?,?)').bind(uid+kind,kind,'course',JSON.stringify({userId:uid,email:mail}),0).run();
 }
 await db.prepare('INSERT INTO codes VALUES(?,?,?,?,?,?,?,?)').bind('used','hash','xxxx','course',365,Date.now()+60000,email,0).run();
 const accept=()=>db.transaction(async()=>db.prepare("INSERT INTO farmakon.deletion_jobs(user_id,email,policy,created,updated) VALUES(?,?,'synthetic-v1',0,0) ON CONFLICT DO NOTHING").bind(a,email).run());
 const late=await pool.connect();
 await late.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
 await late.query('SELECT * FROM farmakon.deletion_jobs WHERE user_id=$1',[a]);
 await Promise.all(Array.from({length:8},accept));
 try{await assert.rejects(async()=>{
  await late.query("INSERT INTO farmakon.activity VALUES('late-inflight',$1,'progress','late','{}',0)",[a]);
  await late.query('COMMIT');
 },e=>['40001','42501'].includes(e.code));}finally{await late.query('ROLLBACK');late.release();}
 assert.equal((await pool.query('SELECT count(*)::int AS n FROM farmakon.deletion_jobs')).rows[0].n,1);
 for(const sql of ['SELECT * FROM farmakon.deletion_jobs',`SELECT farmakon.revoke_synthetic_sessions('${a}')`,`SELECT * FROM farmakon.synthetic_owned_files('${a}')`]){
  const c=await pool.connect();try{await c.query('BEGIN');await c.query('SET LOCAL ROLE authenticated');await assert.rejects(()=>c.query(sql),e=>e.code==='42501');}finally{await c.query('ROLLBACK');c.release();}
 }
 assert.equal((await pool.query('SELECT farmakon.session_is_active($1,$1) AS active',[a])).rows[0].active,false);
 assert.equal((await pool.query('SELECT farmakon.session_is_active($1,$1) AS active',[b])).rows[0].active,true);
 await assert.rejects(()=>db.prepare('INSERT INTO activity VALUES(?,?,?,?,?,?)').bind('late',a,'progress','late','{}',0).run(),e=>e.code==='42501');
 await assert.rejects(()=>db.prepare('INSERT INTO enrollments VALUES(?,?,?,?,?)').bind('late',email,'another',999,'fixture').run(),e=>e.code==='42501');
 await pool.query('SELECT farmakon.revoke_synthetic_sessions($1)',[a]);assert.equal((await pool.query('SELECT * FROM auth.sessions WHERE user_id=$1',[a])).rowCount,0);
 await assert.rejects(()=>pool.query('SELECT farmakon.revoke_synthetic_sessions($1)',[b]),/DELETION_SCOPE/);
 // Orphaned object is discovered. Course/shared reference blocks removal.
 await pool.query("INSERT INTO storage.objects VALUES('orphan','farmakon',$1)",[a]);
 assert.deepEqual((await pool.query('SELECT * FROM farmakon.synthetic_owned_files($1)',[a])).rows,[{name:'orphan'}]);
 await db.prepare('INSERT INTO records VALUES(?,?,?,?,?)').bind('shared','file','course','{"assetId":"orphan"}',0).run();
 await assert.rejects(()=>pool.query('SELECT * FROM farmakon.synthetic_owned_files($1)',[a]),/SHARED/);
 await db.prepare('DELETE FROM records WHERE id=?').bind('shared').run();
 globalThis.__privacyDB=db; // default parameter resolves the injected adapter below
 // Reload after injection (module captures database during evaluation).
 const {deletionStore}=await import(compile(fs.readFileSync('lib/farmakon/privacy/store.ts','utf8').replace("import {database} from '../../database';",'const database=globalThis.__privacyDB;')+'\n// injected'));
 const {resumeDeletion}=await import(compile(fs.readFileSync('lib/farmakon/privacy/deletion.ts','utf8')));
 let fail=true;const provider={async assertFixture(){},async revokeSessions(){},async removePrivateFiles(){if(fail)throw Error('fixture failure');await pool.query('DELETE FROM storage.objects WHERE owner_id=$1',[a])},async deleteAuth(){await pool.query('DELETE FROM auth.users WHERE id=$1',[a])}};
 await assert.rejects(()=>resumeDeletion(deletionStore(db),provider,a));assert.equal((await pool.query('SELECT state FROM farmakon.deletion_jobs')).rows[0].state,'sessions_revoked');
 fail=false;await Promise.all(Array.from({length:8},()=>resumeDeletion(deletionStore(db),provider,a)));
 assert.equal((await pool.query('SELECT state FROM farmakon.deletion_jobs')).rows[0].state,'complete');
 for(const table of ['members','activity','enrollments','records'])assert.equal((await pool.query(`SELECT count(*)::int n FROM farmakon.${table}`)).rows[0].n,table==='records'?3:1);
 assert.equal((await pool.query('SELECT used_by FROM farmakon.codes')).rows[0].used_by,'deleted:'+a);
 assert.equal((await pool.query('SELECT * FROM auth.users WHERE id=$1',[a])).rowCount,0);
 assert.equal((await pool.query('SELECT * FROM auth.users WHERE id=$1',[b])).rowCount,1);
 // Same-email registration cannot silently regain old grants (policy pending).
 await assert.rejects(()=>db.prepare('INSERT INTO members VALUES(?,?,?,?)').bind('new-id',email,'fixture',0).run(),e=>e.code==='42501');
 console.log('PASS: real PostgreSQL acceptance/worker concurrency, tombstone write barrier, RLS/grants, old-session deny, synthetic purge, consumed-code safety, orphan/shared Storage policy, second student intact. Auth/Storage transport fixtures.');
}finally{await pool.query('DROP SCHEMA IF EXISTS auth CASCADE;DROP SCHEMA IF EXISTS storage CASCADE');await close();await pool.query('DROP ROLE IF EXISTS farmakon_app');await pool.end();}
