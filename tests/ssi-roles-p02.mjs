// Real PostgreSQL role boundaries on a synthetic typed table; no Supabase.
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {testDatabase} from './helpers/postgres.mjs';
const {close}=await testDatabase(),pool=new Pool({connectionString:process.env.FARMAKON_TEST_DATABASE_URL,max:2,ssl:false});
let madeRole=false;
try{
 assert.equal((await pool.query("SELECT 1 FROM pg_roles WHERE rolname='p02_backend_fixture'")).rowCount,0);
 await pool.query('CREATE ROLE p02_backend_fixture NOLOGIN NOBYPASSRLS');madeRole=true;
 await pool.query("CREATE TABLE farmakon.p02_private(user_id text NOT NULL, data text NOT NULL); INSERT INTO farmakon.p02_private VALUES('a','private-a'),('b','private-b'); ALTER TABLE farmakon.p02_private ENABLE ROW LEVEL SECURITY; REVOKE ALL ON farmakon.p02_private FROM PUBLIC,anon,authenticated; GRANT USAGE ON SCHEMA farmakon TO p02_backend_fixture; GRANT SELECT ON farmakon.p02_private TO p02_backend_fixture; CREATE POLICY p02_backend_only ON farmakon.p02_private TO p02_backend_fixture USING(true)");
 for(const role of ['anon','authenticated']){const c=await pool.connect();try{await c.query('BEGIN');await c.query('SET LOCAL ROLE '+role);await assert.rejects(()=>c.query('SELECT * FROM farmakon.p02_private'),e=>e.code==='42501');}finally{await c.query('ROLLBACK');c.release();}}
 const c=await pool.connect();try{await c.query('BEGIN');await c.query('SET LOCAL ROLE p02_backend_fixture');assert.equal((await c.query('SELECT * FROM farmakon.p02_private')).rowCount,2);}finally{await c.query('ROLLBACK');c.release();}
 console.log('PASS PostgreSQL fixture roles: anon and authenticated cannot directly read typed table; restricted backend role can. Per-student authorization remains application responsibility; no real Supabase policy proved.');
}finally{await pool.end();await close();if(madeRole){const cleanup=new Pool({connectionString:process.env.FARMAKON_TEST_DATABASE_URL,max:1,ssl:false});try{await cleanup.query('DROP ROLE p02_backend_fixture');}finally{await cleanup.end();}}console.log('CLEANUP synthetic schema and role');}

