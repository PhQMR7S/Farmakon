// Isolated synthetic backfill/rollback experiment, never a production migration.
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {testDatabase} from './helpers/postgres.mjs';
const {close}=await testDatabase();const pool=new Pool({connectionString:process.env.FARMAKON_TEST_DATABASE_URL,max:3,ssl:false});
const evidence={scope:'synthetic SQL backfill only; no live application cutover or Supabase provider',checks:{},duplicateResolution:'none; owner decision needed'};
const now=1790000000000,make=(id,user,exam,status,extra={})=>({id,userId:user,examId:exam,courseId:'course',status,startedAt:now,deadline:now+60000,questions:[{id:'q',correct:1}],answers:{q:1},...extra});
const rows=[
 make('active','a','exam','active'),
 make('done','a','exam','done',{result:{score:1,total:1,questions:[{id:'q',selected:1,correct:1}]}}),
 make('expired','b','exam','active',{deadline:now-1}),
 make('duplicate-1','dup','exam','active'),
 make('duplicate-2','dup','exam','active'),
 make('deleted','deleted','exam','done',{result:{score:0,total:1}}),
 make('revoked','revoked','exam','active')
];
const copy="INSERT INTO farmakon.p02_legacy(id,user_id,exam_id,status,data,created) SELECT id,data::jsonb->>'userId',data::jsonb->>'examId',data::jsonb->>'status',data,created FROM farmakon.records WHERE kind='attempt' ON CONFLICT(id) DO NOTHING";
try{
 await pool.query('CREATE TABLE farmakon.p02_legacy(id text PRIMARY KEY,user_id text NOT NULL,exam_id text NOT NULL,status text NOT NULL,data text NOT NULL,created bigint NOT NULL)');
 await pool.query('CREATE TABLE farmakon.p02_deletion_jobs(user_id text PRIMARY KEY)');
 await pool.query("INSERT INTO farmakon.p02_deletion_jobs VALUES('deleted')");
 await pool.query("INSERT INTO farmakon.enrollments VALUES('revoked-en','revoked@example.test','course',0,'manual')");
 for(const x of rows)await pool.query('INSERT INTO farmakon.records VALUES($1,$2,$3,$4,$5)',[x.id,'attempt','course',JSON.stringify(x),now]);
 await pool.query("INSERT INTO farmakon.activity VALUES('old-result','a','exam','done',$1,$2)",[JSON.stringify({score:1,total:1}),now]);
 // Failure during backfill must rollback every inserted row.
 await pool.query('BEGIN');const partial=await pool.query(copy.replace(' ON CONFLICT'," AND id IN ('active','done','expired') ON CONFLICT")+' RETURNING id');assert.equal(partial.rowCount,3);await pool.query('ROLLBACK');assert.equal((await pool.query('SELECT count(*)::int n FROM farmakon.p02_legacy')).rows[0].n,0);evidence.checks.partialRollback=true;
 await pool.query('BEGIN');await pool.query(copy);await pool.query('COMMIT');await pool.query(copy);
 const diff=await pool.query("SELECT count(*)::int n FROM farmakon.records r FULL JOIN farmakon.p02_legacy t ON t.id=r.id WHERE (r.kind='attempt' OR r.id IS NULL) AND (r.id IS NULL OR t.id IS NULL OR r.data<>t.data OR r.created<>t.created)");
 assert.equal(diff.rows[0].n,0);assert.equal((await pool.query('SELECT count(*)::int n FROM farmakon.p02_legacy')).rows[0].n,rows.length);evidence.checks.exactIdsAndPayload=true;evidence.checks.repeatNoDuplicates=true;
 const duplicate=(await pool.query("SELECT user_id,exam_id,count(*)::int n FROM farmakon.p02_legacy WHERE status='active' GROUP BY user_id,exam_id HAVING count(*)>1")).rows;assert.equal(duplicate.length,1);assert.equal(duplicate[0].n,2);evidence.checks.duplicateGroups=duplicate.length;
 await assert.rejects(()=>pool.query("CREATE UNIQUE INDEX p02_active_unique ON farmakon.p02_legacy(user_id,exam_id) WHERE status='active'"),e=>e.code==='23505');assert.equal((await pool.query("SELECT count(*)::int n FROM farmakon.p02_legacy WHERE user_id='dup'")).rows[0].n,2);evidence.checks.uniqueBlockedWithoutDeletion=true;
 assert.equal((await pool.query("SELECT expires FROM farmakon.enrollments WHERE id='revoked-en'")).rows[0].expires,0);assert.equal((await pool.query("SELECT count(*)::int n FROM farmakon.p02_deletion_jobs WHERE user_id='deleted'")).rows[0].n,1);evidence.checks.tombstoneAndRevokedUnchanged=true;
 assert.equal((await pool.query("SELECT data FROM farmakon.activity WHERE id='old-result'")).rows[0].data,JSON.stringify({score:1,total:1}));evidence.checks.oldActivityUnchanged=true;
 // A deferred uniqueness violation fails at the actual COMMIT and rolls back
 // the whole test transaction; this is not a network-uncertain COMMIT.
 await pool.query('CREATE TABLE farmakon.p02_commit_probe(id int, value int, UNIQUE(value) DEFERRABLE INITIALLY DEFERRED)');
 await pool.query('BEGIN');await pool.query('INSERT INTO farmakon.p02_commit_probe VALUES(1,1),(2,1)');await assert.rejects(()=>pool.query('COMMIT'),e=>e.code==='23505');await pool.query('ROLLBACK');assert.equal((await pool.query('SELECT count(*)::int n FROM farmakon.p02_commit_probe')).rows[0].n,0);evidence.checks.commitFailureRollback=true;
 // Old writers block during the lock but are permitted immediately afterwards.
 // This exposes stale shadow data if maintenance is lifted before cutover.
 for(const [id,label] of [['active','save'],['done','submit'],['expired','start']]){
  const a=await pool.connect(),b=await pool.connect();let resolved=false;
  try{await a.query('BEGIN');await a.query('LOCK TABLE farmakon.records IN SHARE ROW EXCLUSIVE MODE');await a.query(copy);
   const pending=b.query("UPDATE farmakon.records SET data=jsonb_set(data::jsonb,'{probe}',to_jsonb($1::text),true)::text WHERE id=$2",[label,id]).then(()=>{resolved=true;});
   await new Promise(r=>setTimeout(r,40));assert.equal(resolved,false);await a.query('COMMIT');await pending;
  }finally{await a.query('ROLLBACK').catch(()=>{});a.release();b.release();}
 }
 const mismatches=(await pool.query("SELECT count(*)::int n FROM farmakon.records r JOIN farmakon.p02_legacy t ON r.id=t.id WHERE r.kind='attempt' AND r.data<>t.data")).rows[0].n;assert.equal(mismatches,3);evidence.checks.lockBlockedWritersDuringCopy=true;evidence.checks.staleAfterUnlock=mismatches;
 // Existing application storage is unchanged in shape and can still read rows;
 // the old runtime cannot see writes made only to the new layout.
 assert.equal((await pool.query("SELECT count(*)::int n FROM farmakon.records WHERE kind='attempt'")).rows[0].n,rows.length);evidence.checks.oldReaderStillSeesSource=true;await pool.query("INSERT INTO farmakon.p02_legacy VALUES('new-only','a','exam','active','{}',0)");assert.equal((await pool.query("SELECT count(*)::int n FROM farmakon.records WHERE id='new-only'")).rows[0].n,0);evidence.checks.oldReaderMissesNewOnly=true;
 console.log(JSON.stringify(evidence));
}finally{await pool.query('ROLLBACK').catch(()=>{});await pool.end();await close();console.log('CLEANUP synthetic schema and pools');}

