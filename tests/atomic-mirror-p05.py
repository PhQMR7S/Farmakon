"""Real PostgreSQL tests, stdlib only; actual non-admin LOGIN writer connections.
Requires a disposable postgres:17 Docker service, never a remote database URL.
"""
import json
import os
import pathlib
import re
import subprocess
import sys

container = os.environ.get('FARMAKON_P05_CONTAINER', '')
if os.environ.get('FARMAKON_P05_DISPOSABLE') != 'true' or not re.fullmatch(r'[a-f0-9]{12,64}', container):
    raise SystemExit('Disposable container opt-in required')
root = pathlib.Path(__file__).resolve().parent.parent
checks = []


def sql(command, writer=False, fail=None):
    user = 'p05_writer' if writer else 'farmakon_test'
    password = 'p05-fixture-only' if writer else 'fixture-only-password'
    args = ['docker', 'exec', '-i', '-e', 'PGPASSWORD=' + password, container,
            'psql', '-X', '-h', '127.0.0.1', '-U', user, '-d', 'farmakon_v2_test',
            '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-Atq']
    p = subprocess.run(args, input=command, text=True, capture_output=True, timeout=30)
    if fail:
        assert p.returncode != 0 and re.search(r'ERROR:\s+' + fail + r':', p.stderr), p.stderr
    else:
        assert p.returncode == 0, p.stderr
    return p.stdout.strip()


def check(name, condition=True):
    assert condition, name
    checks.append({'name': name, 'status': 'PASS'})


def match():
    for source, shadow, kind in [('records', 'attempt_shadow', 'attempt'), ('activity', 'event_shadow', 'exam')]:
        assert sql(f"SELECT count(*) FROM ((SELECT * FROM p05.{source} WHERE kind='{kind}' EXCEPT SELECT * FROM p05.{shadow}) UNION ALL (SELECT * FROM p05.{shadow} EXCEPT SELECT * FROM p05.{source} WHERE kind='{kind}')) d") == '0'


def snapshot():
    return sql("SELECT jsonb_build_array((SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM p05.records t),(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM p05.attempt_shadow t),(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM p05.activity t),(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM p05.event_shadow t))")


# Unchanged legacy SQL write shape from app/lib/server.ts; only schema qualified
# for isolation. No application-side shadow write or protocol marker is added.
def legacy_write(id, data, kind='attempt'):
    payload = json.dumps(data, separators=(',', ':')).replace("'", "''")
    sql(f"INSERT INTO p05.records(id,kind,course_id,data,created) VALUES('{id}','{kind}','course','{payload}',123) ON CONFLICT(id) DO UPDATE SET data=excluded.data,course_id=excluded.course_id", True)


evidence = {'scope': 'P0.5 isolated PostgreSQL trigger mirroring only',
            'ssiGate': 'FAILED/OPEN; no load run', 'checks': checks}
installed = False
try:
    assert sql("SELECT current_database() || '|' || current_setting('server_version_num')::int/10000") == 'farmakon_v2_test|17'
    assert sql("SELECT count(*) FROM pg_namespace WHERE nspname='p05'") == '0'
    assert sql("SELECT count(*) FROM pg_roles WHERE rolname IN ('p05_owner','p05_mirror','p05_writer')") == '0'
    installed = True  # cleanup also covers partially failed setup
    sql((root / 'tests/fixtures/atomic-mirror-p05.sql').read_text())
    check('writer uses separate non-superuser login', sql("SELECT current_user=session_user AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb FROM pg_roles WHERE rolname=current_user", True) == 't')
    check('writer cannot assume owners', sql("SELECT pg_has_role(current_user,'p05_owner','MEMBER') OR pg_has_role(current_user,'p05_mirror','MEMBER')", True) == 'f')
    active = {'userId': 'a', 'examId': 'exam', 'status': 'active', 'timingVersion': 2,
              'deadline': 999999, 'answers': {'q': 1}, 'questions': [{'id': 'q', 'correct': 1}]}
    done = {**active, 'status': 'done', 'result': {'score': 1, 'total': 1}}
    legacy_write('done', done)
    legacy_write('dup1', active)
    legacy_write('dup2', active)
    original_done = sql("SELECT data FROM p05.records WHERE id='done'")
    match()
    check('legacy INSERT mirrors exact JSON and preserves duplicate attempts')
    legacy_write('dup1', {**active, 'answers': {'q': 2}})
    match()
    check('legacy UPSERT UPDATE mirrors changed answers')
    sql("INSERT INTO p05.activity VALUES('event','a','exam','done','{\"score\":1,\"total\":1}',123); INSERT INTO p05.activity VALUES('progress','a','progress','lesson','{\"seconds\":37}',123)", True)
    match()
    check('exam event mirrored; progress stays legacy only', sql("SELECT count(*) FROM p05.event_shadow") == '1')
    sql("UPDATE p05.activity SET data='{\"score\":0}',user_id='b' WHERE id='event'", True)
    sql("UPDATE p05.records SET data=jsonb_set(data::jsonb,'{userId}','\"b\"')::text WHERE id='dup1'", True)
    match()
    check('ownership and event UPDATE mirrored')
    sql("UPDATE p05.records SET id='renamed' WHERE id='dup2'; UPDATE p05.activity SET id='renamed-event',target='renamed' WHERE id='event'", True)
    match()
    check('primary key updates remove old shadow keys')
    sql("UPDATE p05.records SET kind='ticket' WHERE id='renamed'; UPDATE p05.activity SET kind='progress' WHERE id='renamed-event'", True)
    match()
    check('kind exit removes shadow without deleting legacy')
    sql("UPDATE p05.records SET kind='attempt' WHERE id='renamed'; UPDATE p05.activity SET kind='exam' WHERE id='renamed-event'", True)
    match()
    check('kind entry recreates shadow')
    sql("DELETE FROM p05.records WHERE id='renamed'; DELETE FROM p05.activity WHERE id='renamed-event'", True)
    match()
    check('legacy DELETE removes matching shadows')
    denied = [
        ('shadow select', 'SELECT * FROM p05.attempt_shadow', '42501'),
        ('shadow insert', "INSERT INTO p05.attempt_shadow VALUES('x','attempt','','{}',0)", '42501'),
        ('shadow update', "UPDATE p05.attempt_shadow SET data='{}'", '42501'),
        ('shadow delete', 'DELETE FROM p05.attempt_shadow', '42501'),
        ('event shadow insert', "INSERT INTO p05.event_shadow VALUES('x','a','exam','x','{}',0)", '42501'),
        ('event shadow update', "UPDATE p05.event_shadow SET data='{}'", '42501'),
        ('event shadow delete', 'DELETE FROM p05.event_shadow', '42501'),
        ('source truncate', 'TRUNCATE p05.records', '42501'),
        ('activity truncate', 'TRUNCATE p05.activity', '42501'),
        ('disable trigger', 'ALTER TABLE p05.records DISABLE TRIGGER ALL', '42501'),
        ('drop trigger', 'DROP TRIGGER mirror_event ON p05.activity', '42501'),
        ('replace function', "CREATE OR REPLACE FUNCTION p05.mirror_attempt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$", '42501'),
        ('replication bypass', "SET session_replication_role='replica'", '42501'),
        ('RLS bypass', 'SET row_security=off; UPDATE p05.records SET created=0', '42501'),
        ('assume mirror role', 'SET ROLE p05_mirror', '42501'),
        ('assume owner role', 'SET ROLE p05_owner', '42501'),
    ]
    before = snapshot()
    for name, command, code in denied:
        sql(command, True, code)
        check('denied: ' + name)
    check('denied operations leave data unchanged', snapshot() == before)
    # Constraint faults exist on shadow only; old writers have no awareness of them.
    sql("ALTER TABLE p05.attempt_shadow ADD CONSTRAINT injected_attempt_failure CHECK(id<>'fail-insert' AND data::jsonb->>'fault' IS DISTINCT FROM 'yes')")
    before = snapshot()
    sql("BEGIN ISOLATION LEVEL SERIALIZABLE; UPDATE p05.records SET created=456 WHERE id='dup1'; INSERT INTO p05.records VALUES('fail-insert','attempt','course','{}',123); COMMIT", True, '23514')
    check('shadow INSERT failure rolls back entire transaction and prior writes', snapshot() == before)
    sql("BEGIN ISOLATION LEVEL SERIALIZABLE; UPDATE p05.activity SET updated=456 WHERE id='progress'; UPDATE p05.records SET data=jsonb_set(data::jsonb,'{fault}','\"yes\"')::text WHERE id='dup1'; COMMIT", True, '23514')
    check('shadow UPDATE failure restores deleted shadow and prior progress write', snapshot() == before)
    # FK exists only in fixture to inject a real DELETE failure in the mirror.
    sql("CREATE TABLE p05.delete_guard(id text REFERENCES p05.attempt_shadow(id)); INSERT INTO p05.delete_guard VALUES('dup1')")
    sql("BEGIN ISOLATION LEVEL SERIALIZABLE; UPDATE p05.records SET created=456 WHERE id='done'; DELETE FROM p05.records WHERE id='dup1'; COMMIT", True, '23503')
    check('shadow DELETE failure restores source and all prior writes', snapshot() == before)
    sql('DROP TABLE p05.delete_guard; ALTER TABLE p05.attempt_shadow DROP CONSTRAINT injected_attempt_failure')
    sql("ALTER TABLE p05.event_shadow ADD CONSTRAINT injected_event_failure CHECK(target<>'fault')")
    before = snapshot()
    sql("BEGIN ISOLATION LEVEL SERIALIZABLE; UPDATE p05.records SET data=jsonb_set(data::jsonb,'{answers,q}','3')::text WHERE id='dup1'; INSERT INTO p05.activity VALUES('fault-event','a','exam','fault','{}',123); COMMIT", True, '23514')
    check('event mirror failure rolls back attempt and event together', snapshot() == before)
    sql('ALTER TABLE p05.event_shadow DROP CONSTRAINT injected_event_failure')
    match()
    check('done result and question snapshot remain byte-for-byte unchanged', sql("SELECT data FROM p05.records WHERE id='done'") == original_done)
    check('successful delete does not lose unrelated done result', sql("SELECT count(*) FROM p05.records WHERE id='done'") == '1')
    evidence['postgresVersion'] = sql('SHOW server_version')
    evidence['result'] = 'PASS'
except BaseException:
    evidence['result'] = 'FAIL'
    raise
finally:
    if installed:
        sql('DROP SCHEMA IF EXISTS p05 CASCADE; DROP ROLE IF EXISTS p05_writer,p05_mirror,p05_owner')
        check('cleanup schema and fixture roles', sql("SELECT (SELECT count(*) FROM pg_namespace WHERE nspname='p05')+(SELECT count(*) FROM pg_roles WHERE rolname IN ('p05_owner','p05_mirror','p05_writer'))") == '0')
    output = root / 'docs/evidence/P0.5-ATOMIC-MIRROR.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(evidence, indent=2) + '\n')
    print(json.dumps(evidence))
