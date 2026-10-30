// Docker-only synthetic pg_dump/restore. Never accepts a database URL.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const id=process.env.FARMAKON_P03_CONTAINER;
assert.match(id||'',/^[a-f0-9]{12,64}$/);
const docker=(args,input)=>execFileSync('docker',['exec','-i',id,...args],{input,maxBuffer:8*1024*1024,stdio:['pipe','pipe','pipe']});
const sql=(db,q)=>docker(['psql','-X','-U','farmakon_test','-d',db,'-v','ON_ERROR_STOP=1','-Atc',q]).toString().trim();
assert.equal(sql('farmakon_v2_test','SELECT current_database()'),'farmakon_v2_test');
assert.equal(sql('farmakon_v2_test',"SELECT count(*) FROM pg_database WHERE datname='farmakon_p03_restore_test'"),'0');
assert.equal(sql('farmakon_v2_test',"SELECT count(*) FROM pg_namespace WHERE nspname='p03_backup'"),'0');
let madeSchema=false,madeDatabase=false;
try{
 sql('farmakon_v2_test',`CREATE SCHEMA p03_backup;
 CREATE TABLE p03_backup.attempts(id text PRIMARY KEY,user_id text,status text,data jsonb);
 CREATE TABLE p03_backup.tombstones(user_id text PRIMARY KEY);
 CREATE TABLE p03_backup.entitlements(user_id text PRIMARY KEY,expires bigint);
 INSERT INTO p03_backup.attempts VALUES('a','a','done','{"score":1,"answers":{"q":1}}'),('b','b','active','{"answers":{"q":2}}');
 INSERT INTO p03_backup.entitlements VALUES('a',9999999999999),('b',9999999999999);`);madeSchema=true;
 const before=sql('farmakon_v2_test',"SELECT md5(string_agg(id||user_id||status||data::text,',' ORDER BY id)) FROM p03_backup.attempts");
 const dump=docker(['pg_dump','-U','farmakon_test','-d','farmakon_v2_test','--schema=p03_backup','--no-owner','--no-acl']);
 docker(['createdb','-U','farmakon_test','farmakon_p03_restore_test']);madeDatabase=true;
 docker(['psql','-X','-U','farmakon_test','-d','farmakon_p03_restore_test','-v','ON_ERROR_STOP=1'],dump);
 assert.equal(sql('farmakon_p03_restore_test',"SELECT md5(string_agg(id||user_id||status||data::text,',' ORDER BY id)) FROM p03_backup.attempts"),before);
 // Newest authoritative deletion/revocation events are synthetic and applied
 // to the restore before it is exposed.
 sql('farmakon_p03_restore_test',"INSERT INTO p03_backup.tombstones VALUES('a'); DELETE FROM p03_backup.attempts WHERE user_id IN (SELECT user_id FROM p03_backup.tombstones); UPDATE p03_backup.entitlements SET expires=0 WHERE user_id='b'");
 assert.equal(sql('farmakon_p03_restore_test',"SELECT count(*) FROM p03_backup.attempts WHERE user_id='a'"),'0');
 assert.equal(sql('farmakon_p03_restore_test',"SELECT expires FROM p03_backup.entitlements WHERE user_id='b'"),'0');
 console.log('PASS: synthetic PostgreSQL dump/restore checksum, later deletion and revocation reconciliation. No real Auth/Storage provider or independent ledger proof.');
}finally{
 if(madeDatabase)docker(['dropdb','-U','farmakon_test','farmakon_p03_restore_test']);
 if(madeSchema)sql('farmakon_v2_test','DROP SCHEMA p03_backup CASCADE');
 console.log('CLEANUP isolated synthetic dump/restore database and schema');
}

