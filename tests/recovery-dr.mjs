// CI-only synthetic drill. No URL input, provider credentials or production data.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,readFileSync,rmSync,mkdirSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes,createCipheriv,createDecipheriv,createHash} from 'node:crypto';
assert.equal(process.env.GITHUB_ACTIONS,'true');
const container=process.env.FARMAKON_TEST_CONTAINER;assert.match(container||'',/^[a-f0-9]{12,64}$/);
const docker=(args,input)=>execFileSync('docker',['exec','-i',container,...args],{input,maxBuffer:16*1024*1024,stdio:['pipe','pipe','pipe']});
const sql=(db,q)=>docker(['psql','-X','-U','farmakon_test','-d',db,'-v','ON_ERROR_STOP=1','-Atc',q]).toString().trim();
assert.equal(sql('farmakon_v2_test','select current_database()'),'farmakon_v2_test');
const source='farmakon_dr_source',dest='farmakon_dr_restored';
assert.equal(sql('farmakon_v2_test',`select count(*) from pg_database where datname in ('${source}','${dest}')`),'0');
const dir=mkdtempSync(join(tmpdir(),'farmakon-dr-'));const sha=b=>createHash('sha256').update(b).digest('hex');
const key=randomBytes(32);let createdSource=false,createdDest=false;
try{
 docker(['createdb','-U','farmakon_test',source]);createdSource=true;
 docker(['psql','-X','-U','farmakon_test','-d',source,'-v','ON_ERROR_STOP=1'],readFileSync('tests/fixtures/postgres.sql'));
 sql(source,`CREATE ROLE f004_dr_reader NOLOGIN;
 GRANT USAGE ON SCHEMA farmakon TO f004_dr_reader;
 GRANT SELECT ON farmakon.activity TO f004_dr_reader;
 CREATE POLICY own_activity ON farmakon.activity TO f004_dr_reader USING(user_id=current_setting('farmakon.fixture_uid',true));
 CREATE TABLE farmakon.dr_auth_fixture(id text PRIMARY KEY,role text NOT NULL,email text NOT NULL);
 CREATE TABLE farmakon.dr_deletion_ledger(id text PRIMARY KEY);
 INSERT INTO farmakon.dr_auth_fixture VALUES('owner','owner','owner@example.test'),('a','student','a@example.test'),('b','student','b@example.test'),('deleted','student','deleted@example.test');
 INSERT INTO farmakon.members VALUES('owner','owner@example.test','owner',0),('a','a@example.test','A',0),('b','b@example.test','B',0),('deleted','deleted@example.test','D',0);
 INSERT INTO farmakon.records VALUES('course','course','','{"status":"published"}',0),('exam','exam','course','{"status":"published"}',0),('attempt-a','attempt','course','{"userId":"a","status":"done","result":{"score":1,"total":1}}',0);
 INSERT INTO farmakon.enrollments VALUES('ea','a@example.test','course',9999999999999,'synthetic'),('eb','b@example.test','course',9999999999999,'synthetic');
 INSERT INTO farmakon.activity VALUES('aa','a','progress','lesson','{"note":"ملاحظة خاصة A"}',0),('bb','b','progress','lesson','{"note":"private B"}',0);`);
 const pdf=Buffer.from('%PDF-1.4\n% Synthetic Farmakon DR attachment\n%%EOF\n');
 const manifest={version:1,scope:'synthetic-only',auth:'fixture-model-not-Supabase-Auth',storage:'local-object-fixture-not-Supabase-Storage',files:[{path:'fixture.pdf',size:pdf.length,sha256:sha(pdf)}]};
 mkdirSync(join(dir,'source-files'),{mode:0o700});writeFileSync(join(dir,'source-files','fixture.pdf'),pdf,{mode:0o600});
 const backupAt=Date.now();
 const dump=docker(['pg_dump','-U','farmakon_test','-d',source,'--schema=farmakon','--no-owner','--no-acl']);
 const payload=Buffer.from(JSON.stringify({manifest,sql:dump.toString('base64'),files:{'fixture.pdf':pdf.toString('base64')}}));
 const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,nonce);cipher.setAAD(Buffer.from('farmakon-synthetic-backup-v1'));
 const sealed=Buffer.concat([nonce,cipher.update(payload),cipher.final(),cipher.getAuthTag()]);
 writeFileSync(join(dir,'backup.enc'),sealed,{mode:0o600});
 const decrypt=data=>{const d=createDecipheriv('aes-256-gcm',key,data.subarray(0,12));d.setAAD(Buffer.from('farmakon-synthetic-backup-v1'));d.setAuthTag(data.subarray(-16));return Buffer.concat([d.update(data.subarray(12,-16)),d.final()]);};
 const tampered=Buffer.from(sealed);tampered[20]^=1;assert.throws(()=>decrypt(tampered));assert.throws(()=>{const k=createDecipheriv('aes-256-gcm',randomBytes(32),nonce);k.setAuthTag(sealed.subarray(-16));k.update(sealed.subarray(12,-16));k.final()});
 // Deletion occurs AFTER snapshot. Newest ledger is outside the old backup.
 sql(source,"INSERT INTO farmakon.dr_deletion_ledger VALUES('deleted');DELETE FROM farmakon.dr_auth_fixture WHERE id='deleted';DELETE FROM farmakon.members WHERE id='deleted'");
 const deletionLedger=sql(source,'SELECT id FROM farmakon.dr_deletion_ledger ORDER BY id').split('\n');
 const recoveryStart=Date.now();
 const restored=JSON.parse(decrypt(readFileSync(join(dir,'backup.enc'))).toString());assert.deepEqual(restored.manifest,manifest);
 docker(['createdb','-U','farmakon_test',dest]);createdDest=true;
 docker(['psql','-X','-U','farmakon_test','-d',dest,'-v','ON_ERROR_STOP=1'],Buffer.from(restored.sql,'base64'));
 // Restore grants explicitly: no ACL or secrets from backup are trusted.
 sql(dest,'GRANT USAGE ON SCHEMA farmakon TO f004_dr_reader;GRANT SELECT ON farmakon.activity TO f004_dr_reader');
 assert.equal(sql(dest,"select count(*) from farmakon.members where id='deleted'"),'1','Old backup contains deleted identity: quarantine must not be skipped');
 for(const id of deletionLedger){assert.match(id,/^[a-z]+$/);sql(dest,`DELETE FROM farmakon.members WHERE id='${id}';DELETE FROM farmakon.dr_auth_fixture WHERE id='${id}';INSERT INTO farmakon.dr_deletion_ledger VALUES('${id}') ON CONFLICT DO NOTHING`);}
 mkdirSync(join(dir,'restored-files'),{mode:0o700});
 for(const f of restored.manifest.files){assert.equal(f.path,'fixture.pdf');const bytes=Buffer.from(restored.files[f.path],'base64');assert.equal(bytes.length,f.size);assert.equal(sha(bytes),f.sha256);writeFileSync(join(dir,'restored-files',f.path),bytes,{mode:0o600});}
 assert.deepEqual(readdirSync(join(dir,'restored-files')),['fixture.pdf']);
 assert.equal(sha(readFileSync(join(dir,'restored-files','fixture.pdf'))),sha(pdf));
 for(const table of ['members','enrollments','records','activity','dr_auth_fixture','dr_deletion_ledger'])assert.equal(sql(dest,`SELECT md5(coalesce(string_agg(t::text,',' ORDER BY t::text),'')) FROM farmakon.${table} t`),sql(source,`SELECT md5(coalesce(string_agg(t::text,',' ORDER BY t::text),'')) FROM farmakon.${table} t`));
 assert.equal(sql(dest,"SELECT count(*) FROM farmakon.enrollments e LEFT JOIN farmakon.records c ON c.id=e.course_id WHERE c.id IS NULL"),'0');
 assert.equal(sql(dest,"SELECT count(*) FROM farmakon.records r LEFT JOIN farmakon.members m ON m.id=r.data::jsonb->>'userId' WHERE r.kind='attempt' AND m.id IS NULL"),'0');
 for(const uid of ['a','b'])assert.equal(sql(dest,`BEGIN;SET LOCAL ROLE f004_dr_reader;SET LOCAL farmakon.fixture_uid='${uid}';SELECT user_id FROM farmakon.activity;ROLLBACK`).split('\n').filter(x=>!['BEGIN','SET','ROLLBACK'].includes(x)).join(''),uid);
 assert.equal(sql(dest,"SELECT count(*) FROM farmakon.dr_auth_fixture WHERE id='deleted'"),'0');
 console.log(JSON.stringify({result:'PASS_PARTIAL',scope:'synthetic PostgreSQL + local object/Auth fixtures',rpo_ms:0,rpo_basis:'quiescent snapshot; no ordinary writes after snapshot; newer deletion ledger replayed',rto_ms:Date.now()-recoveryStart,snapshot_age_ms:Date.now()-backupAt,checks:'AES-256-GCM tamper/wrong-key rejection, table hashes, Arabic JSON, keys/references, RLS isolation, PDF checksum, deletion ledger replay',blocked:'Real Supabase Auth identities/passwords/sessions and Storage API restore not exercised'}));
}finally{
 key.fill(0);rmSync(dir,{recursive:true,force:true});
 if(createdDest)docker(['dropdb','-U','farmakon_test',dest]);if(createdSource)docker(['dropdb','-U','farmakon_test',source]);
 sql('farmakon_v2_test','DROP ROLE IF EXISTS f004_dr_reader');
}
