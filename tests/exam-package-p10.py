"""Execute the prepared install/activation/rollback/uninstall package in Docker only."""
import json, os, pathlib, re, subprocess, time
root=pathlib.Path(__file__).resolve().parent.parent
container=os.environ.get('FARMAKON_P10_CONTAINER','')
assert os.environ.get('FARMAKON_P10_DISPOSABLE')=='true' and re.fullmatch(r'[a-f0-9]{12,64}',container)
checks=[];ev={'scope':'P0.10 isolated operational package; not service approval','checks':checks,'result':'FAIL'}
def command(writer=False):
 user='p10_backend' if writer else 'farmakon_test'
 password='p10-fixture-only' if writer else 'fixture-only-password'
 return ['docker','exec','-i','-e','PGPASSWORD='+password,container,'psql','-X','-h','127.0.0.1','-U',user,'-d','farmakon_v2_test','-Atq','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose']
def sql(s,writer=False,fail=None):
 p=subprocess.run(command(writer),input=s,text=True,capture_output=True,timeout=35)
 if fail: assert p.returncode and (fail is True or fail in p.stderr),p.stderr
 else: assert p.returncode==0,p.stderr
 return p.stdout.strip()
def package(name,authorized=True,drained=True,fail=None):
 args=command()+['-v','app_role=p10_backend']
 if authorized:args+=['-v','operator_authorized=APPROVED']
 if drained:args+=['-v','writers_drained=YES']
 args+=['-f','/tmp/exam-package-p10/'+name+'.sql']
 p=subprocess.run(args,text=True,capture_output=True,timeout=35)
 if fail:assert p.returncode and (fail is True or fail in p.stderr),p.stderr
 else:assert p.returncode==0,p.stderr
def ok(s):checks.append({'name':s,'status':'PASS'})
def state():
 return sql("SELECT jsonb_build_array((SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM farmakon.records t),(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM farmakon.activity t),(SELECT jsonb_agg(to_jsonb(t) ORDER BY user_id) FROM farmakon.deletion_jobs t),(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM farmakon.exam_attempts t),(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM farmakon.exam_results t),(SELECT ready FROM farmakon.exam_store_control WHERE id='exam-v1'))")
installed=False
try:
 assert sql('SELECT current_database()')=='farmakon_v2_test'
 assert sql("SELECT count(*) FROM pg_namespace WHERE nspname='farmakon'")=='0'
 assert sql("SELECT count(*) FROM pg_roles WHERE rolname IN ('p10_backend','anon','authenticated')")=='0'
 installed=True
 sql("CREATE ROLE p10_backend LOGIN PASSWORD 'p10-fixture-only' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE; CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN")
 sql((root/'tests/fixtures/postgres.sql').read_text())
 subprocess.run(['docker','cp',str(root/'scripts/exam-store/package'),container+':/tmp/exam-package-p10'],check=True,capture_output=True)
 package('install',authorized=False,fail='22012')
 assert sql("SELECT to_regclass('farmakon.exam_store_control') IS NULL")=='t'
 ok('unapproved invocation refuses before schema creation')
 package('install',fail='42P01')
 assert sql("SELECT to_regclass('farmakon.exam_store_control') IS NULL")=='t'
 ok('missing deletion ledger refuses without partial installation')
 sql('CREATE TABLE farmakon.deletion_jobs(user_id text PRIMARY KEY,email text); ALTER TABLE farmakon.deletion_jobs ENABLE ROW LEVEL SECURITY')
 for table in ['records','activity','settings','members','enrollments','codes','deletion_jobs']:
  sql('GRANT SELECT,INSERT,UPDATE,DELETE ON farmakon.'+table+' TO p10_backend; CREATE POLICY p10_backend ON farmakon.'+table+' TO p10_backend USING(true) WITH CHECK(true)')
 sql('GRANT USAGE ON SCHEMA farmakon TO p10_backend')
 sql('ALTER ROLE p10_backend BYPASSRLS')
 package('install',fail='22012')
 assert sql("SELECT to_regclass('farmakon.exam_store_control') IS NULL")=='t'
 sql('ALTER ROLE p10_backend NOBYPASSRLS')
 ok('unsafe backend rejected atomically')
 source_acl=sql("SELECT jsonb_agg(jsonb_build_array(relname,relacl::text) ORDER BY relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='farmakon'")
 package('install')
 assert sql("SELECT ready FROM farmakon.exam_store_control")=='f'
 assert sql("SELECT count(*) FROM pg_inherits i JOIN pg_class c ON c.oid=i.inhparent JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='farmakon' AND c.relname IN ('exam_attempts','exam_results')")=='64'
 ok('atomic inactive install creates 32 attempt and 32 result partitions')
 assert sql("SELECT current_user",True)=='p10_backend'
 assert sql("SELECT ready FROM farmakon.exam_store_control",True)=='f'
 sql("UPDATE farmakon.exam_store_control SET ready=true",True,fail='42501')
 sql("ALTER TABLE farmakon.records DISABLE TRIGGER ALL",True,fail='42501')
 sql("SET session_replication_role='replica'",True,fail='42501')
 sql("SELECT * FROM farmakon.exam_attempts_p0",True,fail='42501')
 assert sql("SELECT bool_and(NOT has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')) FROM pg_roles r CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE r.rolname IN ('anon','authenticated') AND n.nspname='farmakon' AND c.relname ~ '^exam_(attempts|results)'")=='t'
 ok('limited login cannot change mode, disable triggers, bypass replica or read child; browser roles denied')
 sql("INSERT INTO farmakon.exam_attempts VALUES('u','inactive','attempt','','{\"userId\":\"u\"}',1)",True,fail='55000')
 ok('backend cannot write specialized store while inactive')
 done={'userId':'u','examId':'exam','status':'done','questions':[{'id':'q','correct':1}],'answers':{'q':1},'result':{'score':1,'total':1}}
 active={**done,'status':'active','answers':{},'result':None}
 for id,d in [('done',done),('active',active)]:
  sql("INSERT INTO farmakon.records VALUES('"+id+"','attempt','course','"+json.dumps(d).replace("'","''")+"',123)")
 sql("INSERT INTO farmakon.records VALUES('catalogue','course','','{\"status\":\"published\"}',1); INSERT INTO farmakon.activity VALUES('done-event','u','exam','done','{\"score\":1,\"total\":1}',123); INSERT INTO farmakon.activity VALUES('progress','u','progress','lesson','{\"seconds\":37}',123)")
 before=state()
 package('activate',drained=False,fail='22012');assert state()==before
 ok('activation requires maintenance attestation and preserves state on refusal')
 # Hold a real backend transaction without table locks; drain check must reject it.
 worker=subprocess.Popen(command(True)+['-c',"BEGIN; SET application_name='p10-held'; SELECT pg_sleep(4); ROLLBACK"],text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 try:
  for _ in range(30):
   if sql("SELECT count(*) FROM pg_stat_activity WHERE application_name='p10-held' AND xact_start IS NOT NULL")=='1':break
   time.sleep(.05)
  else:raise AssertionError('held transaction not observed')
  package('activate',fail='22012');assert state()==before
 finally:worker.communicate(timeout=8)
 ok('activation refuses a real in-flight backend transaction')
 # Ambiguous old attempts are preserved and block activation.
 sql("INSERT INTO farmakon.records SELECT 'duplicate',kind,course_id,data,created FROM farmakon.records WHERE id='active'")
 duplicate=state();package('activate',fail='22012');assert state()==duplicate
 sql("DELETE FROM farmakon.records WHERE id='duplicate'")
 ok('duplicate active legacy data blocks without choosing or deleting a winner')
 sql("ALTER TABLE farmakon.exam_attempts ADD CONSTRAINT p10_fail CHECK(id<>'active')")
 package('activate',fail='23514');assert state()==before
 sql("ALTER TABLE farmakon.exam_attempts DROP CONSTRAINT p10_fail")
 ok('copy failure rolls back copied rows, source removal and readiness')
 package('activate')
 assert sql("SELECT ready FROM farmakon.exam_store_control")=='t'
 assert sql("SELECT count(*) FROM farmakon.records WHERE kind='attempt'")=='0'
 assert sql("SELECT count(*) FROM farmakon.exam_attempts")=='2'
 assert sql("SELECT count(*) FROM farmakon.activity WHERE kind='progress'")=='1'
 assert sql("SELECT data FROM farmakon.exam_attempts WHERE id='done'")==json.dumps(done)
 ok('activation copies exact JSON and results while preserving catalogue/progress')
 sql("INSERT INTO farmakon.records VALUES('old-write','attempt','course','{}',1)",True,fail='55000')
 sql("INSERT INTO farmakon.activity VALUES('old-event','u','exam','done','{}',1)",True,fail='55000')
 ok('unmodified old writer is rejected after activation')
 sql("BEGIN ISOLATION LEVEL SERIALIZABLE; UPDATE farmakon.exam_attempts SET data=jsonb_set(jsonb_set(data::jsonb,'{status}','\"done\"'),'{answers}','{\"q\":1}')::text WHERE user_id='u' AND id='active'; INSERT INTO farmakon.exam_results VALUES('new-result','u','exam','active','{\"score\":1,\"total\":1}',456); COMMIT",True)
 changed=state()
 package('uninstall',fail='P0001');assert state()==changed
 ok('uninstall refuses an active store without deleting data')
 # Tombstoned specialized data must not be copied back by rollback.
 sql("INSERT INTO farmakon.deletion_jobs VALUES('u','fixture@example.test')")
 tombstoned=state();package('rollback',fail='P0001');assert state()==tombstoned
 sql("DELETE FROM farmakon.deletion_jobs WHERE user_id='u'")
 ok('rollback refuses to resurrect deletion-ledger identities')
 sql("ALTER TABLE farmakon.records ADD CONSTRAINT p10_rollback_fail CHECK(id<>'active')")
 package('rollback',fail='23514');assert state()==changed
 sql("ALTER TABLE farmakon.records DROP CONSTRAINT p10_rollback_fail")
 ok('rollback failure restores active marker and all specialized data')
 package('rollback')
 assert sql("SELECT ready FROM farmakon.exam_store_control")=='f'
 assert sql("SELECT count(*) FROM farmakon.exam_attempts")=='0'
 assert sql("SELECT count(*) FROM farmakon.records WHERE kind='attempt'")=='2'
 assert sql("SELECT data::jsonb->'answers'->>'q' FROM farmakon.records WHERE id='active'")=='1'
 assert sql("SELECT count(*) FROM farmakon.activity WHERE kind='exam'")=='2'
 assert sql("SELECT data FROM farmakon.records WHERE id='done'")==json.dumps(done)
 ok('successful rollback preserves new answers, new events and old awarded result')
 legacy_after=sql("SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM farmakon.records t")
 package('uninstall')
 assert sql("SELECT to_regclass('farmakon.exam_store_control') IS NULL")=='t'
 assert sql("SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM farmakon.records t")==legacy_after
 assert sql("SELECT to_regclass('farmakon.deletion_jobs') IS NOT NULL")=='t'
 ok('safe uninstall removes only package objects, retaining ledger and legacy data')
 ev['result']='PASS';ev['postgres']=sql('SHOW server_version')
finally:
 if installed:
  sql('DROP SCHEMA IF EXISTS farmakon CASCADE; DROP ROLE IF EXISTS p10_backend,anon,authenticated')
  assert sql("SELECT count(*) FROM pg_namespace WHERE nspname='farmakon'")=='0'
  ok('isolated schema and fixture roles cleaned up')
 output=root/'docs/evidence/P0.10-OPERATIONAL-PACKAGE.json';output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(ev,indent=2)+'\n');print(json.dumps(ev))
