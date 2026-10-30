// Synthetic, local PostgreSQL protocol prototype; not an application migration.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {Pool} from 'pg';
import {testDatabase} from './helpers/postgres.mjs';
const {close}=await testDatabase(),pool=new Pool({connectionString:process.env.FARMAKON_TEST_DATABASE_URL,max:6,ssl:false});
const root=await pool.connect();
const ev={scope:'synthetic SQL protocol only; not production cutover',checks:{},errors:[]};
const now=Date.now(), row=(id,u,status,extra={})=>({id,userId:u,examId:'exam',courseId:'course',status,startedAt:now,deadline:now+60000,questions:[{id:'q',correct:1}],answers:{q:1},...extra});
const initial=[row('dup1','dup','active'),row('dup2','dup','active'),row('active','a','active'),row('done','a','done',{result:{score:1,total:1}}),row('expired','b','active',{deadline:now-1}),row('deleted','gone','done',{result:{score:0,total:1}}),row('revoked','revoked','active')];
const digest=s=>crypto.createHash('sha256').update(s).digest('hex');
async function writer(op,id,transform,{fail=false,loseAck=false}={}){
 const c=await pool.connect();
 try{await c.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
  const prior=await c.query('SELECT payload_hash FROM farmakon.p03_ops WHERE id=$1',[op]);
  const h=digest(id+'|'+transform);if(prior.rowCount){assert.equal(prior.rows[0].payload_hash,h);await c.query('COMMIT');return 'already-confirmed';}
  const before=await c.query('SELECT data FROM farmakon.records WHERE id=$1',[id]);assert.equal(before.rowCount,1);const d=JSON.parse(before.rows[0].data);if((await c.query('SELECT 1 FROM farmakon.p03_tombstones WHERE user_id=$1',[d.userId])).rowCount)throw Error('tombstoned');
  if(transform==='save'){assert.equal(d.status,'active');d.answers={...d.answers,q:2};}
  if(transform==='submit'||transform==='settle'){if(d.status==='active'){d.status='done';d.result={score:1,total:1};}}
  if(transform==='delete')d.deleted=true;
  const next=JSON.stringify(d);
  await c.query('UPDATE farmakon.records SET data=$1 WHERE id=$2',[next,id]);
  if(fail)throw Error('synthetic failure after first write');
  const target=await c.query('UPDATE farmakon.p03_target SET data=$1,status=$3 WHERE id=$2',[next,id,d.status]);if(target.rowCount!==1)throw Error('shadow missing');
  if(d.status==='done')await c.query('INSERT INTO farmakon.p03_events(id,score) VALUES($1,$2) ON CONFLICT(id) DO NOTHING',[id,d.result.score]);
  await c.query('INSERT INTO farmakon.p03_ops VALUES($1,$2)',[op,h]);
  await c.query('COMMIT');if(loseAck)throw Object.assign(Error('synthetic lost response after successful commit'),{lost:true});return 'committed';
 }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
}
async function match(){return (await root.query("SELECT count(*)::int n FROM farmakon.records r FULL JOIN farmakon.p03_target t USING(id) WHERE r.kind='attempt' AND (t.id IS NULL OR r.data<>t.data OR r.data::jsonb->>'status'<>t.status)")).rows[0].n;}
try{
 await root.query("CREATE TABLE farmakon.p03_target(id text PRIMARY KEY,user_id text NOT NULL,exam_id text NOT NULL,status text NOT NULL,data text NOT NULL); CREATE TABLE farmakon.p03_control(id text PRIMARY KEY,mode text NOT NULL); INSERT INTO farmakon.p03_control VALUES('cutover','old'); CREATE TABLE farmakon.p03_ops(id text PRIMARY KEY,payload_hash text NOT NULL); CREATE TABLE farmakon.p03_events(id text PRIMARY KEY,score integer NOT NULL); CREATE TABLE farmakon.p03_tombstones(user_id text PRIMARY KEY); INSERT INTO farmakon.p03_tombstones VALUES('gone');");
 for(const r of initial)await root.query('INSERT INTO farmakon.records VALUES($1,$2,$3,$4,$5)',[r.id,'attempt','course',JSON.stringify(r),now]);
 await root.query("INSERT INTO farmakon.enrollments VALUES('revoked','revoked@example.test','course',0,'manual')");
 const dups=await root.query("SELECT data::jsonb->>'userId' u,data::jsonb->>'examId' e,count(*)::int n FROM farmakon.records WHERE kind='attempt' AND data::jsonb->>'status'='active' GROUP BY 1,2 HAVING count(*)>1");assert.equal(dups.rowCount,1);assert.equal(dups.rows[0].n,2);ev.checks.duplicatesDetectedReadOnly=true;
 // Reservations are group-level markers, not a choice of a winning legacy row.
 await root.query('CREATE TABLE farmakon.p03_reservations(user_id text,exam_id text,PRIMARY KEY(user_id,exam_id))');
 await root.query("INSERT INTO farmakon.p03_reservations SELECT DISTINCT data::jsonb->>'userId',data::jsonb->>'examId' FROM farmakon.records WHERE kind='attempt' AND data::jsonb->>'status'='active'");
 assert.equal((await root.query("INSERT INTO farmakon.p03_reservations VALUES('dup','exam') ON CONFLICT DO NOTHING")).rowCount,0);assert.equal((await root.query("SELECT count(*)::int n FROM farmakon.records WHERE id IN ('dup1','dup2')")).rows[0].n,2);ev.checks.duplicateReservationPreservesBoth=true;
 // Failed fence transaction restores source, target and control marker.
 await root.query('BEGIN ISOLATION LEVEL SERIALIZABLE');await root.query('LOCK TABLE farmakon.records IN SHARE ROW EXCLUSIVE MODE');await root.query("INSERT INTO farmakon.p03_target SELECT id,data::jsonb->>'userId',data::jsonb->>'examId',data::jsonb->>'status',data FROM farmakon.records WHERE kind='attempt'");await root.query("UPDATE farmakon.p03_control SET mode='new'");await root.query('ROLLBACK');
 assert.equal((await root.query('SELECT count(*)::int n FROM farmakon.p03_target')).rows[0].n,0);assert.equal((await root.query('SELECT mode FROM farmakon.p03_control')).rows[0].mode,'old');ev.checks.fenceFailureRollback=true;
 // In-flight writer owns the shared protocol lock, cutover waits for it.
 const w=await pool.connect(),cut=await pool.connect();let acquired=false;
 try{
  await w.query('BEGIN ISOLATION LEVEL SERIALIZABLE');await w.query("SELECT mode FROM farmakon.p03_control WHERE id='cutover' FOR SHARE");
  await w.query("UPDATE farmakon.records SET data=jsonb_set(data::jsonb,'{inflight}','true'::jsonb)::text WHERE id='active'");
  await cut.query('BEGIN ISOLATION LEVEL SERIALIZABLE');const waiting=cut.query("SELECT mode FROM farmakon.p03_control WHERE id='cutover' FOR UPDATE").then(()=>{acquired=true;});await new Promise(r=>setTimeout(r,60));assert.equal(acquired,false);await w.query('COMMIT');let retried=0;
  try{
   await waiting;
   await cut.query("INSERT INTO farmakon.p03_target SELECT id,data::jsonb->>'userId',data::jsonb->>'examId',data::jsonb->>'status',data FROM farmakon.records WHERE kind='attempt'");
   await cut.query("UPDATE farmakon.p03_control SET mode='new'");await cut.query('COMMIT');
  }catch(e){assert.equal(e.code,'40001');await cut.query('ROLLBACK');retried++;await cut.query('BEGIN ISOLATION LEVEL SERIALIZABLE');await cut.query("SELECT mode FROM farmakon.p03_control WHERE id='cutover' FOR UPDATE");await cut.query("INSERT INTO farmakon.p03_target SELECT id,data::jsonb->>'userId',data::jsonb->>'examId',data::jsonb->>'status',data FROM farmakon.records WHERE kind='attempt'");await cut.query("UPDATE farmakon.p03_control SET mode='new'");await cut.query('COMMIT');}
  ev.checks.fenceSerializationRetries=retried;
 }finally{await w.query('ROLLBACK').catch(()=>{});await cut.query('ROLLBACK').catch(()=>{});w.release();cut.release();}
 assert.equal(await match(),0);assert.equal((await root.query('SELECT count(*)::int n FROM farmakon.p03_target')).rows[0].n,initial.length);assert.equal((await root.query("SELECT mode FROM farmakon.p03_control")).rows[0].mode,'new');ev.checks.fenceWaitAndAtomicCopy=true;
 // Protocol compliant post-cutover writer consults marker and targets new only.
 await root.query('BEGIN ISOLATION LEVEL SERIALIZABLE');const mode=(await root.query("SELECT mode FROM farmakon.p03_control WHERE id='cutover' FOR SHARE")).rows[0].mode;assert.equal(mode,'new');await root.query("UPDATE farmakon.p03_target SET data=jsonb_set(data::jsonb,'{after}','true'::jsonb)::text WHERE id='active'");await root.query('COMMIT');assert.equal((await root.query("SELECT data::jsonb ? 'after' ok FROM farmakon.records WHERE id='active'")).rows[0].ok,false);ev.checks.protocolWriterUsesNewOnly=true;await root.query("UPDATE farmakon.records SET data=jsonb_set(data::jsonb,'{bypass}','true'::jsonb)::text WHERE id='active'");assert.ok((await match())>0);ev.checks.legacyWriterBypassesProtocol=true;
 // Reconcile synthetic state explicitly before independent dual-write scenario.
 await root.query("UPDATE farmakon.p03_target t SET data=r.data FROM farmakon.records r WHERE t.id=r.id");assert.equal(await match(),0);
 const original=(await root.query("SELECT data FROM farmakon.records WHERE id='active'")).rows[0].data;
 await assert.rejects(()=>writer('failed-save','active','save',{fail:true}),/synthetic failure/);assert.equal((await root.query("SELECT data FROM farmakon.records WHERE id='active'")).rows[0].data,original);assert.equal(await match(),0);assert.equal((await root.query("SELECT count(*)::int n FROM farmakon.p03_ops WHERE id='failed-save'")).rows[0].n,0);ev.checks.dualWriteFailureAtomic=true;
 await root.query("DELETE FROM farmakon.p03_target WHERE id='active'");await assert.rejects(()=>writer('missing-shadow','active','save'),/shadow missing/);assert.equal((await root.query("SELECT data FROM farmakon.records WHERE id='active'")).rows[0].data,original);await root.query("INSERT INTO farmakon.p03_target SELECT id,data::jsonb->>'userId',data::jsonb->>'examId',data::jsonb->>'status',data FROM farmakon.records WHERE id='active'");ev.checks.missingShadowRollsBack=true;
 await assert.rejects(()=>writer('lost-save','active','save',{loseAck:true}),e=>e.lost);assert.equal(await writer('lost-save','active','save'),'already-confirmed');assert.equal(await match(),0);ev.checks.lostResponseStableId=true;
 await writer('submit','active','submit');assert.equal(await writer('submit','active','submit'),'already-confirmed');await writer('settle','expired','settle');assert.equal((await root.query("SELECT count(*)::int n FROM farmakon.p03_events WHERE id='active'")).rows[0].n,1);assert.equal(await match(),0);ev.checks.submitSettleSingleEvent=true;const previousDone=(await root.query("SELECT data FROM farmakon.records WHERE id='done'")).rows[0].data;await writer('replay-done','done','submit');assert.equal((await root.query("SELECT data FROM farmakon.records WHERE id='done'")).rows[0].data,previousDone);await assert.rejects(()=>writer('deleted-user','deleted','submit'),/tombstoned/);ev.checks.doneImmutableAndTombstoneDenied=true;
 await assert.rejects(()=>writer('submit','active','save'));ev.checks.keyReuseDifferentPayloadRejected=true;
 // Inject a real PostgreSQL 40001 after updating source; rollback must leave both unchanged.
 const c=await pool.connect();try{await c.query('BEGIN ISOLATION LEVEL SERIALIZABLE');await c.query("UPDATE farmakon.records SET data='{}' WHERE id='done'");await assert.rejects(()=>c.query("DO $$ BEGIN RAISE EXCEPTION 'fixture' USING ERRCODE='40001'; END $$"),e=>e.code==='40001');await c.query('ROLLBACK');}finally{c.release();}
 assert.equal(await match(),0);ev.checks.injected40001RollsBack=true;
 // Simulated deletion in both copies and separate tombstone; provider deletion is not tested.
 await root.query('BEGIN ISOLATION LEVEL SERIALIZABLE');await root.query("INSERT INTO farmakon.p03_tombstones VALUES('a')");await root.query("DELETE FROM farmakon.records WHERE id='active'");await root.query("DELETE FROM farmakon.p03_target WHERE id='active'");await root.query("DELETE FROM farmakon.p03_events WHERE id='active'");await root.query('COMMIT');
 assert.equal((await root.query("SELECT count(*)::int n FROM farmakon.p03_target WHERE id='active'")).rows[0].n,0);assert.equal((await root.query("SELECT count(*)::int n FROM farmakon.p03_tombstones WHERE user_id='a'")).rows[0].n,1);ev.checks.syntheticDeletionBothCopies=true;
 assert.equal((await root.query("SELECT data FROM farmakon.records WHERE id='done'")).rows[0].data,JSON.stringify(initial.find(r=>r.id==='done')));assert.equal((await root.query("SELECT expires FROM farmakon.enrollments WHERE id='revoked'")).rows[0].expires,0);assert.equal((await root.query("SELECT count(*)::int n FROM farmakon.p03_target WHERE id IN ('dup1','dup2')")).rows[0].n,2);ev.checks.legacyDoneDuplicatesRevokedPreserved=true;
 console.log(JSON.stringify(ev));
}finally{await root.query('ROLLBACK').catch(()=>{});root.release();await pool.end();await close();console.log('CLEANUP isolated schema and pools');}

