// Cryptographic and completeness contract only: NOT an Auth/Storage restore.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {seal,openAndValidate,digest} from './backup-envelope.mjs';
const expected={snapshotId:'synthetic-f009',schemaVersion:'fixture-v1',migrations:['fixture-001'],paths:['database.sql','auth-fixture.json','storage-index.json','objects/a.pdf','objects/b.pdf']};
function fixture(){
 const files=Object.fromEntries(expected.paths.map(p=>[p,Buffer.from(p.endsWith('.pdf')?'%PDF-1.4\nSynthetic '+p+'\n%%EOF\n':'synthetic-only '+p)]));
 return {manifest:{version:1,scope:'synthetic-only',snapshotId:expected.snapshotId,schemaVersion:expected.schemaVersion,migrations:[...expected.migrations],files:Object.entries(files).map(([path,b])=>({path,size:b.length,sha256:digest(b)}))},files:Object.fromEntries(Object.entries(files).map(([p,b])=>[p,b.toString('base64')]))};
}
function rejectMutation(mut){const key=randomBytes(32);try{const p=fixture();mut(p);assert.throws(()=>openAndValidate(seal(p,key),key,expected),/^Error: DR_BACKUP_REJECTED$/);}finally{key.fill(0);}}
test('round trip verifies every synthetic component and both PDF byte hashes',()=>{const key=randomBytes(32);try{const p=fixture(),a=seal(p,key),b=seal(p,key);assert.notDeepEqual(a,b);const files=openAndValidate(a,key,expected);assert.equal(files.size,5);for(const [path,bytes] of files)assert.equal(bytes.toString('base64'),p.files[path]);}finally{key.fill(0);}});
test('ciphertext corruption rejected',()=>{const key=randomBytes(32);try{const b=seal(fixture(),key);b[20]^=1;assert.throws(()=>openAndValidate(b,key,expected),/DR_BACKUP_REJECTED/);}finally{key.fill(0);}});
test('wrong key rejected with the correct AAD',()=>{const key=randomBytes(32),wrong=randomBytes(32);try{assert.throws(()=>openAndValidate(seal(fixture(),key),wrong,expected),/DR_BACKUP_REJECTED/);}finally{key.fill(0);wrong.fill(0);}});
test('truncated ciphertext rejected',()=>{const key=randomBytes(32);try{assert.throws(()=>openAndValidate(seal(fixture(),key).subarray(0,35),key,expected),/DR_BACKUP_REJECTED/);}finally{key.fill(0);}});
test('missing object rejected even with valid encryption',()=>rejectMutation(p=>delete p.files['objects/a.pdf']));
test('missing object AND manifest entry rejected by independent inventory',()=>rejectMutation(p=>{delete p.files['objects/a.pdf'];p.manifest.files=p.manifest.files.filter(f=>f.path!=='objects/a.pdf');}));
test('missing Auth component rejected',()=>rejectMutation(p=>delete p.files['auth-fixture.json']));
test('unexpected archive component rejected',()=>rejectMutation(p=>p.files['secrets.txt']='eA=='));
test('duplicate manifest path rejected',()=>rejectMutation(p=>p.manifest.files.push(p.manifest.files[0])));
test('incorrect checksum rejected',()=>rejectMutation(p=>p.manifest.files[0].sha256='0'.repeat(64)));
test('incorrect size rejected',()=>rejectMutation(p=>p.manifest.files[0].size++));
test('noncanonical base64 rejected',()=>rejectMutation(p=>p.files['database.sql']+='\n'));
test('unreviewed migration set rejected',()=>rejectMutation(p=>p.manifest.migrations.push('unreviewed')));
test('schema version mismatch rejected',()=>rejectMutation(p=>p.manifest.schemaVersion='other'));
test('snapshot substitution rejected',()=>rejectMutation(p=>p.manifest.snapshotId='older'));
test('path traversal rejected even if caller inventory contains it',()=>{const key=randomBytes(32);try{const p=fixture(),f=p.manifest.files[0];p.files['../database.sql']=p.files[f.path];delete p.files[f.path];f.path='../database.sql';assert.throws(()=>openAndValidate(seal(p,key),key,{...expected,paths:expected.paths.map(v=>v==='database.sql'?'../database.sql':v)}),/DR_BACKUP_REJECTED/);}finally{key.fill(0);}});
