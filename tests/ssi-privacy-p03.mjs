// Fixture-only PostgreSQL privacy/restore model; no Supabase provider.
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {testDatabase} from './helpers/postgres.mjs';
const {close}=await testDatabase(),pool=new Pool({connectionString:process.env.FARMAKON_TEST_DATABASE_URL,max:2,ssl:false});const roles=['p03_a','p03_b','p03_owner','p03_backend','p03_visitor'];const created=[];
try{
 for(const role of roles){assert.equal((await pool.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount,0);await pool.query('CREATE ROLE '+role+' NOLOGIN NOBYPASSRLS');created.push(role);}
 await pool.query("CREATE TABLE farmakon.p03_attempts(id text PRIMARY KEY,user_id text,data text); CREATE TABLE farmakon.p03_tombstones(user_id text PRIMARY KEY); CREATE TABLE farmakon.p03_entitlements(user_id text PRIMARY KEY,expires bigint); INSERT INTO farmakon.p03_attempts VALUES('a1','p03_a','A private'),('b1','p03_b','B private'); INSERT INTO farmakon.p03_entitlements VALUES('p03_a',9999999999999),('p03_b',9999999999999); ALTER TABLE farmakon.p03_attempts ENABLE ROW LEVEL SECURITY; REVOKE ALL ON farmakon.p03_attempts FROM PUBLIC,anon,authenticated; GRANT USAGE ON SCHEMA farmakon TO p03_a,p03_b,p03_owner,p03_backend,p03_visitor; GRANT SELECT ON farmakon.p03_attempts TO p03_a,p03_b,p03_owner,p03_backend; CREATE POLICY p03_student ON farmakon.p03_attempts TO p03_a,p03_b USING(user_id=current_user::text); CREATE POLICY p03_admin ON farmakon.p03_attempts TO p03_owner,p03_backend USING(true)");
 for(const [role,expected] of [['p03_a',['a1']],['p03_b',['b1']],['p03_owner',['a1','b1']],['p03_backend',['a1','b1']]]){const c=await pool.connect();try{await c.query('BEGIN ISOLATION LEVEL SERIALIZABLE');await c.query('SET LOCAL ROLE '+role);assert.deepEqual((await c.query('SELECT id FROM farmakon.p03_attempts ORDER BY id')).rows.map(x=>x.id),expected);}finally{await c.query('ROLLBACK');c.release();}}
 {const c=await pool.connect();try{await c.query('BEGIN ISOLATION LEVEL SERIALIZABLE');await c.query('SET LOCAL ROLE p03_visitor');await assert.rejects(()=>c.query('SELECT * FROM farmakon.p03_attempts'),e=>e.code==='42501');}finally{await c.query('ROLLBACK');c.release();}}
 // Snapshot is an in-database SQL model, not pg_dump or Supabase recovery.
 await pool.query('CREATE TABLE farmakon.p03_snapshot AS TABLE farmakon.p03_attempts');await pool.query('CREATE TABLE farmakon.p03_ent_snapshot AS TABLE farmakon.p03_entitlements');
 await pool.query("BEGIN ISOLATION LEVEL SERIALIZABLE; INSERT INTO farmakon.p03_tombstones VALUES('p03_a'); DELETE FROM farmakon.p03_attempts WHERE user_id='p03_a'; UPDATE farmakon.p03_entitlements SET expires=0 WHERE user_id='p03_b'; COMMIT");
 await pool.query('CREATE TABLE farmakon.p03_restored AS TABLE farmakon.p03_snapshot');await pool.query('DELETE FROM farmakon.p03_restored WHERE user_id IN (SELECT user_id FROM farmakon.p03_tombstones)');
 assert.deepEqual((await pool.query('SELECT id FROM farmakon.p03_restored ORDER BY id')).rows.map(r=>r.id),['b1']);assert.equal((await pool.query("SELECT expires FROM farmakon.p03_entitlements WHERE user_id='p03_b'")).rows[0].expires,0);
 const old=(await pool.query("SELECT expires FROM farmakon.p03_ent_snapshot WHERE user_id='p03_b'")).rows[0].expires;assert.ok(old>0);
 console.log('PASS PostgreSQL role/isolation and synthetic snapshot reconciliation: deleted A removed; newer B revocation remains authoritative. In-database model only, no Auth/Storage or actual backup.');
}finally{await pool.end();await close();if(created.length){const p=new Pool({connectionString:process.env.FARMAKON_TEST_DATABASE_URL,max:1,ssl:false});try{for(const r of created)await p.query('DROP ROLE '+r);}finally{await p.end();}}console.log('CLEANUP synthetic schema and roles');}

