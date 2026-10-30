"""Disposable PostgreSQL tests for aggregate-only read-only legacy preflight."""
import json, os, pathlib, re, subprocess
root=pathlib.Path(__file__).resolve().parent.parent
container=os.environ.get('FARMAKON_P09_CONTAINER','')
assert os.environ.get('FARMAKON_P09_DISPOSABLE')=='true' and re.fullmatch(r'[a-f0-9]{12,64}',container)
checks=[]
ev={'scope':'P0.9 isolated preflight; no service or real data read','checks':checks,'result':'FAIL'}
def sql(command,role='p09_backend',fail=None):
 args=['docker','exec','-i',container,'psql','-X','-U','farmakon_test','-d','farmakon_v2_test','-Atq','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-v','app_role='+role]
 r=subprocess.run(args,input=command,text=True,capture_output=True,timeout=30)
 if fail: assert r.returncode and fail in r.stderr,r.stderr
 else: assert r.returncode==0,r.stderr
 return r.stdout.strip()
def ok(name): checks.append({'name':name,'status':'PASS'})
def run(role='p09_backend'): return json.loads(sql((root/'scripts/exam-store/legacy-preflight.sql').read_text(),role))
def snapshot(): return sql("SELECT md5(string_agg(id||kind||data,',' ORDER BY id)) FROM farmakon.records")
def seed(id,d): sql("INSERT INTO farmakon.records VALUES('"+id+"','attempt','','"+json.dumps(d).replace("'","''")+"',1)")
installed=False
try:
 assert sql('SELECT current_database()')=='farmakon_v2_test'
 assert sql("SELECT count(*) FROM pg_namespace WHERE nspname='farmakon'")=='0'
 assert sql("SELECT count(*) FROM pg_roles WHERE rolname='p09_backend'")=='0'
 installed=True
 sql("CREATE ROLE p09_backend NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE")
 sql((root/'tests/fixtures/postgres.sql').read_text())
 sql('CREATE TABLE farmakon.deletion_jobs(user_id text PRIMARY KEY,email text)')
 done={'userId':'fixture-private-user','examId':'exam','status':'done','questions':[{'id':'q','correct':1}],'answers':{'q':1},'result':{'score':1,'total':1}}
 seed('done',done)
 sql("INSERT INTO farmakon.activity VALUES('event','fixture-private-user','exam','done','{}',1)")
 before=snapshot();clean=run();assert clean['status']=='PASS',clean
 assert snapshot()==before;ok('valid legacy data passes without mutation')
 text=json.dumps(clean);assert 'fixture-private-user' not in text and '"correct"' not in text and '"answers"' not in text;ok('aggregate output excludes identity and answer data')
 sql("INSERT INTO farmakon.records VALUES('bad','attempt','','not-json',1)")
 r=run();assert r['issues']['invalid_attempt_json']==1;assert r['status']=='BLOCKED';ok('malformed JSON blocks without query crash')
 sql("DELETE FROM farmakon.records WHERE id='bad'")
 active={**done,'status':'active'}
 seed('dup1',active);seed('dup2',active)
 before=snapshot();r=run();assert r['issues']['duplicate_active_groups']==1;assert snapshot()==before;ok('duplicate active group blocks and preserves both attempts')
 sql("DELETE FROM farmakon.records WHERE id IN ('dup1','dup2')")
 seed('missing',{'status':'done','answers':[],'questions':{},'result':{}})
 r=run();assert r['issues']['missing_attempt_identity']==1 and r['issues']['invalid_answers']==1 and r['issues']['invalid_done_result']==1 and r['issues']['missing_questions_snapshot']==1;ok('invalid snapshot, identity, answers and result are counted')
 sql("DELETE FROM farmakon.records WHERE id='missing'; INSERT INTO farmakon.deletion_jobs VALUES('fixture-private-user','private@example.test')")
 assert run()['issues']['deleted_identity_attempts']==1;ok('durable deletion job blocks restored legacy identity')
 sql("DELETE FROM farmakon.deletion_jobs; INSERT INTO farmakon.activity VALUES('orphan','other','exam','done','{}',1)")
 assert run()['issues']['orphan_or_foreign_result_events']==1;ok('cross-user result link blocks')
 sql("DELETE FROM farmakon.activity WHERE id='orphan'")
 assert run('missing_role')['issues']['missing_backend_role']==1;ok('missing backend role blocks')
 sql('ALTER ROLE p09_backend BYPASSRLS')
 assert run()['issues']['privileged_backend_role']==1;ok('BYPASSRLS backend blocks')
 sql('ALTER ROLE p09_backend NOBYPASSRLS; ALTER TABLE farmakon.records OWNER TO p09_backend')
 assert run()['issues']['backend_owns_source']==1;ok('source ownership escalation blocks')
 sql('ALTER TABLE farmakon.records OWNER TO farmakon_test; GRANT INSERT ON farmakon.records TO PUBLIC')
 assert run()['issues']['public_source_write_grants']==1;ok('public source write privilege blocks')
 sql('REVOKE INSERT ON farmakon.records FROM PUBLIC')
 assert run()['status']=='PASS';ok('clean state restored without data repair by preflight')
 # PostgreSQL itself rejects mutation in the same kind of read-only transaction.
 sql("BEGIN READ ONLY; DELETE FROM farmakon.records; COMMIT",fail='25006');ok('database enforces read-only transaction')
 ev['result']='PASS'
finally:
 if installed:
  sql('DROP SCHEMA IF EXISTS farmakon CASCADE; DROP ROLE IF EXISTS p09_backend')
  assert sql("SELECT count(*) FROM pg_namespace WHERE nspname='farmakon'")=='0'
  ok('fixture schema and role cleanup')
 out=root/'docs/evidence/P0.9-LEGACY-PREFLIGHT.json';out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(ev,indent=2)+'\n');print(json.dumps(ev))
