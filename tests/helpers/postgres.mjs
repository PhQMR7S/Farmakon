import {Pool} from 'pg';
import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';

// Deliberately accepts only an empty, dedicated loopback database. Never uses DATABASE_URL.
export async function testDatabase(){
 const url=new URL(process.env.FARMAKON_TEST_DATABASE_URL);
 assert.ok(['127.0.0.1','localhost','[::1]'].includes(url.hostname),'Tests require loopback Postgres');
 assert.equal(url.pathname,'/farmakon_v2_test','Tests require dedicated farmakon_v2_test database');
 assert.equal(url.search,'','Connection options are not accepted');
 const bootstrap=new Pool({connectionString:url.href,ssl:false});
 const existing=await bootstrap.query("SELECT 1 FROM pg_namespace WHERE nspname='farmakon'");
 assert.equal(existing.rowCount,0,'Refusing to touch an existing farmakon schema');
 await bootstrap.query(fs.readFileSync('tests/fixtures/postgres.sql','utf8'));
 // Load the actual production adapter; inject only the disposable connection and local TLS setting.
 const source=fs.readFileSync('lib/database.ts','utf8')
  .replace("import 'server-only';",'')
  .replace("from 'pg'",`from ${JSON.stringify(import.meta.resolve('pg'))}`)
  .replaceAll('process.env.DATABASE_URL','process.env.FARMAKON_TEST_DATABASE_URL')
  .replace('ssl:{rejectUnauthorized:true,ca:process.env.DATABASE_CA_CERT}','ssl:false')
  +'\nexport async function closeTestPool(){await pool?.end();}';
 const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
 const mod=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
 console.log('PostgreSQL integration: real production SQL adapter + route handlers; stubbed Auth/Storage transport.');
 return {db:mod.database,async close(){await mod.closeTestPool();await bootstrap.query('DROP SCHEMA farmakon CASCADE');await bootstrap.end();}};
}
