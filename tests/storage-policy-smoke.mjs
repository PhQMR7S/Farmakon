import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Client} from 'pg';

// Disposable loopback Postgres only. Auth claims and Storage tables are fixtures;
// the actual staging policy SQL is exercised with real PostgreSQL roles and RLS.
const url=new URL(process.env.FARMAKON_TEST_DATABASE_URL);
assert.ok(['127.0.0.1','localhost','[::1]'].includes(url.hostname));
assert.equal(url.pathname,'/farmakon_v2_test');assert.equal(url.search,'');
const db=new Client({connectionString:url.href,ssl:false});await db.connect();
try{
 const existing=await db.query("SELECT nspname FROM pg_namespace WHERE nspname IN ('farmakon','auth','storage')");
 assert.equal(existing.rowCount,0,'Refusing to touch existing application/provider schemas');
 await db.query('BEGIN');
 await db.query(fs.readFileSync('tests/fixtures/postgres.sql','utf8'));
 for(const role of ['anon','authenticated'])await db.query(`DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='${role}') THEN CREATE ROLE ${role} NOLOGIN;END IF;END $$`);
 await db.query(`CREATE SCHEMA auth; CREATE SCHEMA storage;
 CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'sub')::uuid $$;
 GRANT USAGE ON SCHEMA auth,storage TO anon,authenticated;
 CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 CREATE TABLE storage.objects(name text PRIMARY KEY,bucket_id text NOT NULL);
 ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
 GRANT SELECT,INSERT ON storage.objects TO anon,authenticated;`);
 await db.query(fs.readFileSync('scripts/staging/20261026081826_p0_staging_storage.sql','utf8'));
 await db.query("INSERT INTO farmakon.settings VALUES('storage-owner',$1)",[JSON.stringify({email:'owner@example.test'})]);
 const record=async(id,kind,courseId,data)=>db.query('INSERT INTO farmakon.records VALUES($1,$2,$3,$4,0)',[id,kind,courseId,JSON.stringify(data)]);
 await record('course','course','',{status:'published'});
 for(const [name,free,status] of [['free',true,'published'],['paid',false,'published'],['draft',true,'draft']]){
  await record(name,'file','course',{assetId:name,status,free});
  await db.query("INSERT INTO storage.objects VALUES($1,'farmakon')",[name]);
 }
 await db.query("INSERT INTO farmakon.enrollments VALUES('enrollment','a@example.test','course',$1,'fixture')",[Date.now()+60000]);
 const claims=email=>({sub:'00000000-0000-4000-8000-000000000001',email});
 async function asRole(role,claim,fn){
  await db.query('SAVEPOINT role_test');
  try{await db.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify(claim)]);await db.query(`SET LOCAL ROLE ${role}`);return await fn();}
  finally{await db.query('ROLLBACK TO SAVEPOINT role_test');await db.query('RELEASE SAVEPOINT role_test');}
 }
 const visible=claim=>asRole('authenticated',claim,async()=>
  (await db.query('SELECT name FROM storage.objects ORDER BY name')).rows.map(r=>r.name));
 assert.deepEqual(await visible(claims('owner@example.test')),['draft','free','paid']);
 assert.deepEqual(await visible(claims('a@example.test')),['free','paid']);
 assert.deepEqual(await visible(claims('b@example.test')),['free']);
 assert.deepEqual(await visible({email:'owner@example.test'}),[],'Missing authenticated uid cannot read');
 await asRole('authenticated',claims('owner@example.test'),async()=>assert.equal((await db.query("INSERT INTO storage.objects VALUES('owner-upload','farmakon') RETURNING name")).rowCount,1));
 await assert.rejects(asRole('authenticated',claims('b@example.test'),()=>db.query("INSERT INTO storage.objects VALUES('forbidden-upload','farmakon')")),e=>e.code==='42501');
 await assert.rejects(asRole('authenticated',claims('owner@example.test'),()=>db.query("INSERT INTO storage.objects VALUES('wrong-bucket','other')")),e=>e.code==='42501');
 await assert.rejects(asRole('authenticated',claims('a@example.test'),()=>db.query('SELECT * FROM farmakon.records')),e=>e.code==='42501');
 await assert.rejects(asRole('anon',{},()=>db.query("SELECT farmakon.farmakon_can_read_asset('free')")),e=>e.code==='42501');
 await db.query('UPDATE farmakon.enrollments SET expires=0');
 assert.deepEqual(await visible(claims('a@example.test')),['free'],'Expired enrollment loses paid object');
 await db.query("UPDATE farmakon.records SET data='{\"status\":\"draft\"}' WHERE id='course'");
 assert.deepEqual(await visible(claims('b@example.test')),[],'Draft parent hides free object');
 await db.query("UPDATE farmakon.records SET data='{\"status\":\"published\"}',kind='announcement' WHERE id='course'");
 assert.deepEqual(await visible(claims('b@example.test')),[],'Wrong parent kind cannot grant media access');
 console.log('PASS: real PostgreSQL Storage RLS: owner upload, two-user entitlement isolation, draft/expiry/parent checks, private table and anonymous denial.');
}finally{await db.query('ROLLBACK');await db.end();}
