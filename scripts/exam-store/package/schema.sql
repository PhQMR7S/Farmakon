CREATE TABLE farmakon.exam_store_control(id text PRIMARY KEY CHECK(id='exam-v1'),ready boolean NOT NULL);
INSERT INTO farmakon.exam_store_control VALUES('exam-v1',false);
CREATE TABLE farmakon.exam_attempts(
 user_id text NOT NULL,id text NOT NULL,kind text NOT NULL CHECK(kind='attempt'),
 course_id text NOT NULL,data text NOT NULL,created bigint NOT NULL,
 CHECK(data::jsonb->>'userId'=user_id),PRIMARY KEY(user_id,id)
) PARTITION BY HASH(user_id);
CREATE TABLE farmakon.exam_results(
 id text NOT NULL,user_id text NOT NULL,kind text NOT NULL CHECK(kind='exam'),
 target text NOT NULL,data text NOT NULL,updated bigint NOT NULL,
 PRIMARY KEY(user_id,kind,target)
) PARTITION BY HASH(user_id);
DO $$ BEGIN
 FOR n IN 0..31 LOOP
  EXECUTE format('CREATE TABLE farmakon.exam_attempts_p%s PARTITION OF farmakon.exam_attempts FOR VALUES WITH (MODULUS 32,REMAINDER %s)',n,n);
  EXECUTE format('CREATE TABLE farmakon.exam_results_p%s PARTITION OF farmakon.exam_results FOR VALUES WITH (MODULUS 32,REMAINDER %s)',n,n);
 END LOOP;
END $$;
CREATE INDEX ON farmakon.exam_attempts(user_id,(data::jsonb->>'status'),created DESC,id DESC);
ALTER TABLE farmakon.exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE farmakon.exam_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE farmakon.exam_store_control ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON farmakon.exam_attempts,farmakon.exam_results,farmakon.exam_store_control FROM PUBLIC;
-- Parent and child relations have no public client privileges; child RLS is enabled too.
DO $$ DECLARE t text; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='farmakon' AND (tablename ~ '^exam_(attempts|results)_p[0-9]+) LOOP
  EXECUTE format('ALTER TABLE farmakon.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON farmakon.%I FROM PUBLIC',t);
 END LOOP;
END $$;
CREATE FUNCTION farmakon.exam_legacy_write_fence() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM farmakon.exam_store_control WHERE ready) AND
 ((TG_TABLE_NAME='records' AND (NEW.kind='attempt' OR (TG_OP='UPDATE' AND OLD.kind='attempt'))) OR
 (TG_TABLE_NAME='activity' AND (NEW.kind='exam' OR (TG_OP='UPDATE' AND OLD.kind='exam'))))
 THEN RAISE EXCEPTION 'EXAM_LEGACY_WRITER_BLOCKED' USING ERRCODE='55000'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION farmakon.exam_legacy_write_fence() FROM PUBLIC;
CREATE TRIGGER exam_legacy_fence BEFORE INSERT OR UPDATE ON farmakon.records FOR EACH ROW EXECUTE FUNCTION farmakon.exam_legacy_write_fence();
CREATE TRIGGER exam_event_legacy_fence BEFORE INSERT OR UPDATE ON farmakon.activity FOR EACH ROW EXECUTE FUNCTION farmakon.exam_legacy_write_fence();
ALTER TABLE farmakon.records ENABLE ALWAYS TRIGGER exam_legacy_fence;
ALTER TABLE farmakon.activity ENABLE ALWAYS TRIGGER exam_event_legacy_fence;

-- Reuse the existing deletion lock key and durable job as a tombstone.
CREATE FUNCTION farmakon.exam_deletion_barrier() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text,0));
 IF TG_TABLE_NAME='deletion_jobs' THEN
  PERFORM 1 FROM farmakon.exam_attempts WHERE user_id=NEW.user_id::text;
  PERFORM 1 FROM farmakon.exam_results WHERE user_id=NEW.user_id::text;
 ELSE
  IF EXISTS(SELECT 1 FROM farmakon.deletion_jobs WHERE user_id::text=NEW.user_id::text)
  THEN RAISE EXCEPTION 'ACCOUNT_DELETING' USING ERRCODE='42501'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION farmakon.exam_deletion_barrier() FROM PUBLIC;
CREATE TRIGGER exam_attempt_deletion BEFORE INSERT OR UPDATE ON farmakon.exam_attempts FOR EACH ROW EXECUTE FUNCTION farmakon.exam_deletion_barrier();
CREATE TRIGGER exam_result_deletion BEFORE INSERT OR UPDATE ON farmakon.exam_results FOR EACH ROW EXECUTE FUNCTION farmakon.exam_deletion_barrier();
-- Installation refuses to omit the existing deletion ledger.
CREATE TRIGGER exam_delete_accept BEFORE INSERT ON farmakon.deletion_jobs FOR EACH ROW EXECUTE FUNCTION farmakon.exam_deletion_barrier();
GRANT SELECT,INSERT,UPDATE,DELETE ON farmakon.exam_attempts,farmakon.exam_results TO :"app_role";
GRANT SELECT ON farmakon.exam_store_control TO :"app_role";
CREATE POLICY exam_backend_v1 ON farmakon.exam_attempts TO :"app_role" USING(true) WITH CHECK(true);
CREATE POLICY exam_backend_v1 ON farmakon.exam_results TO :"app_role" USING(true) WITH CHECK(true);
CREATE POLICY exam_backend_v1 ON farmakon.exam_store_control FOR SELECT TO :"app_role" USING(true);
ALTER TABLE farmakon.exam_attempts ENABLE ALWAYS TRIGGER exam_attempt_deletion;
ALTER TABLE farmakon.exam_results ENABLE ALWAYS TRIGGER exam_result_deletion;
ALTER TABLE farmakon.deletion_jobs ENABLE ALWAYS TRIGGER exam_delete_accept;
-- Never grant browser roles or direct child access. Revoke any inherited default ACL.
SELECT format('REVOKE ALL ON %s FROM %I',c.oid::regclass,r.rolname)
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN pg_roles r
WHERE n.nspname='farmakon' AND (c.relname IN ('exam_attempts','exam_results','exam_store_control') OR c.relname ~ '^exam_(attempts|results)_p[0-9]+)
AND r.rolname IN ('anon','authenticated')
\gexec
SELECT format('REVOKE ALL ON %s FROM %I',c.oid::regclass,:'app_role')
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='farmakon' AND (c.relname LIKE 'exam_attempts_p%' OR c.relname LIKE 'exam_results_p%')
\gexec
) LOOP
  EXECUTE format('ALTER TABLE farmakon.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON farmakon.%I FROM PUBLIC',t);
 END LOOP;
END $$;
CREATE FUNCTION farmakon.exam_legacy_write_fence() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM farmakon.exam_store_control WHERE ready) AND
 ((TG_TABLE_NAME='records' AND (NEW.kind='attempt' OR (TG_OP='UPDATE' AND OLD.kind='attempt'))) OR
 (TG_TABLE_NAME='activity' AND (NEW.kind='exam' OR (TG_OP='UPDATE' AND OLD.kind='exam'))))
 THEN RAISE EXCEPTION 'EXAM_LEGACY_WRITER_BLOCKED' USING ERRCODE='55000'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION farmakon.exam_legacy_write_fence() FROM PUBLIC;
CREATE TRIGGER exam_legacy_fence BEFORE INSERT OR UPDATE ON farmakon.records FOR EACH ROW EXECUTE FUNCTION farmakon.exam_legacy_write_fence();
CREATE TRIGGER exam_event_legacy_fence BEFORE INSERT OR UPDATE ON farmakon.activity FOR EACH ROW EXECUTE FUNCTION farmakon.exam_legacy_write_fence();
ALTER TABLE farmakon.records ENABLE ALWAYS TRIGGER exam_legacy_fence;
ALTER TABLE farmakon.activity ENABLE ALWAYS TRIGGER exam_event_legacy_fence;

-- Reuse the existing deletion lock key and durable job as a tombstone.
CREATE FUNCTION farmakon.exam_deletion_barrier() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text,0));
 IF TG_TABLE_NAME='deletion_jobs' THEN
  PERFORM 1 FROM farmakon.exam_attempts WHERE user_id=NEW.user_id::text;
  PERFORM 1 FROM farmakon.exam_results WHERE user_id=NEW.user_id::text;
 ELSE
  IF EXISTS(SELECT 1 FROM farmakon.deletion_jobs WHERE user_id::text=NEW.user_id::text)
  THEN RAISE EXCEPTION 'ACCOUNT_DELETING' USING ERRCODE='42501'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION farmakon.exam_deletion_barrier() FROM PUBLIC;
CREATE TRIGGER exam_attempt_deletion BEFORE INSERT OR UPDATE ON farmakon.exam_attempts FOR EACH ROW EXECUTE FUNCTION farmakon.exam_deletion_barrier();
CREATE TRIGGER exam_result_deletion BEFORE INSERT OR UPDATE ON farmakon.exam_results FOR EACH ROW EXECUTE FUNCTION farmakon.exam_deletion_barrier();
-- Installation refuses to omit the existing deletion ledger.
CREATE TRIGGER exam_delete_accept BEFORE INSERT ON farmakon.deletion_jobs FOR EACH ROW EXECUTE FUNCTION farmakon.exam_deletion_barrier();
GRANT SELECT,INSERT,UPDATE,DELETE ON farmakon.exam_attempts,farmakon.exam_results TO :"app_role";
GRANT SELECT ON farmakon.exam_store_control TO :"app_role";
CREATE POLICY exam_backend_v1 ON farmakon.exam_attempts TO :"app_role" USING(true) WITH CHECK(true);
CREATE POLICY exam_backend_v1 ON farmakon.exam_results TO :"app_role" USING(true) WITH CHECK(true);
CREATE POLICY exam_backend_v1 ON farmakon.exam_store_control FOR SELECT TO :"app_role" USING(true);
ALTER TABLE farmakon.exam_attempts ENABLE ALWAYS TRIGGER exam_attempt_deletion;
ALTER TABLE farmakon.exam_results ENABLE ALWAYS TRIGGER exam_result_deletion;
ALTER TABLE farmakon.deletion_jobs ENABLE ALWAYS TRIGGER exam_delete_accept;
-- Never grant browser roles or direct child access. Revoke any inherited default ACL.
SELECT format('REVOKE ALL ON %s FROM %I',c.oid::regclass,r.rolname)
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN pg_roles r
WHERE n.nspname='farmakon' AND (c.relname IN ('exam_attempts','exam_results','exam_store_control') OR c.relname LIKE 'exam_attempts_p%' OR c.relname LIKE 'exam_results_p%')
AND r.rolname IN ('anon','authenticated')
\gexec
SELECT format('REVOKE ALL ON %s FROM %I',c.oid::regclass,:'app_role')
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='farmakon' AND (c.relname LIKE 'exam_attempts_p%' OR c.relname LIKE 'exam_results_p%')
\gexec
)
AND r.rolname IN ('anon','authenticated')
\gexec
SELECT format('REVOKE ALL ON %s FROM %I',c.oid::regclass,:'app_role')
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='farmakon' AND (c.relname ~ '^exam_(attempts|results)_p[0-9]+)
\gexec
) LOOP
  EXECUTE format('ALTER TABLE farmakon.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON farmakon.%I FROM PUBLIC',t);
 END LOOP;
END $$;
CREATE FUNCTION farmakon.exam_legacy_write_fence() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM farmakon.exam_store_control WHERE ready) AND
 ((TG_TABLE_NAME='records' AND (NEW.kind='attempt' OR (TG_OP='UPDATE' AND OLD.kind='attempt'))) OR
 (TG_TABLE_NAME='activity' AND (NEW.kind='exam' OR (TG_OP='UPDATE' AND OLD.kind='exam'))))
 THEN RAISE EXCEPTION 'EXAM_LEGACY_WRITER_BLOCKED' USING ERRCODE='55000'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION farmakon.exam_legacy_write_fence() FROM PUBLIC;
CREATE TRIGGER exam_legacy_fence BEFORE INSERT OR UPDATE ON farmakon.records FOR EACH ROW EXECUTE FUNCTION farmakon.exam_legacy_write_fence();
CREATE TRIGGER exam_event_legacy_fence BEFORE INSERT OR UPDATE ON farmakon.activity FOR EACH ROW EXECUTE FUNCTION farmakon.exam_legacy_write_fence();
ALTER TABLE farmakon.records ENABLE ALWAYS TRIGGER exam_legacy_fence;
ALTER TABLE farmakon.activity ENABLE ALWAYS TRIGGER exam_event_legacy_fence;

-- Reuse the existing deletion lock key and durable job as a tombstone.
CREATE FUNCTION farmakon.exam_deletion_barrier() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text,0));
 IF TG_TABLE_NAME='deletion_jobs' THEN
  PERFORM 1 FROM farmakon.exam_attempts WHERE user_id=NEW.user_id::text;
  PERFORM 1 FROM farmakon.exam_results WHERE user_id=NEW.user_id::text;
 ELSE
  IF EXISTS(SELECT 1 FROM farmakon.deletion_jobs WHERE user_id::text=NEW.user_id::text)
  THEN RAISE EXCEPTION 'ACCOUNT_DELETING' USING ERRCODE='42501'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION farmakon.exam_deletion_barrier() FROM PUBLIC;
CREATE TRIGGER exam_attempt_deletion BEFORE INSERT OR UPDATE ON farmakon.exam_attempts FOR EACH ROW EXECUTE FUNCTION farmakon.exam_deletion_barrier();
CREATE TRIGGER exam_result_deletion BEFORE INSERT OR UPDATE ON farmakon.exam_results FOR EACH ROW EXECUTE FUNCTION farmakon.exam_deletion_barrier();
-- Installation refuses to omit the existing deletion ledger.
CREATE TRIGGER exam_delete_accept BEFORE INSERT ON farmakon.deletion_jobs FOR EACH ROW EXECUTE FUNCTION farmakon.exam_deletion_barrier();
GRANT SELECT,INSERT,UPDATE,DELETE ON farmakon.exam_attempts,farmakon.exam_results TO :"app_role";
GRANT SELECT ON farmakon.exam_store_control TO :"app_role";
CREATE POLICY exam_backend_v1 ON farmakon.exam_attempts TO :"app_role" USING(true) WITH CHECK(true);
CREATE POLICY exam_backend_v1 ON farmakon.exam_results TO :"app_role" USING(true) WITH CHECK(true);
CREATE POLICY exam_backend_v1 ON farmakon.exam_store_control FOR SELECT TO :"app_role" USING(true);
ALTER TABLE farmakon.exam_attempts ENABLE ALWAYS TRIGGER exam_attempt_deletion;
ALTER TABLE farmakon.exam_results ENABLE ALWAYS TRIGGER exam_result_deletion;
ALTER TABLE farmakon.deletion_jobs ENABLE ALWAYS TRIGGER exam_delete_accept;
-- Never grant browser roles or direct child access. Revoke any inherited default ACL.
SELECT format('REVOKE ALL ON %s FROM %I',c.oid::regclass,r.rolname)
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN pg_roles r
WHERE n.nspname='farmakon' AND (c.relname IN ('exam_attempts','exam_results','exam_store_control') OR c.relname LIKE 'exam_attempts_p%' OR c.relname LIKE 'exam_results_p%')
AND r.rolname IN ('anon','authenticated')
\gexec
SELECT format('REVOKE ALL ON %s FROM %I',c.oid::regclass,:'app_role')
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='farmakon' AND (c.relname LIKE 'exam_attempts_p%' OR c.relname LIKE 'exam_results_p%')
\gexec
)
\gexec
) LOOP
  EXECUTE format('ALTER TABLE farmakon.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON farmakon.%I FROM PUBLIC',t);
 END LOOP;
END $$;
CREATE FUNCTION farmakon.exam_legacy_write_fence() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM farmakon.exam_store_control WHERE ready) AND
 ((TG_TABLE_NAME='records' AND (NEW.kind='attempt' OR (TG_OP='UPDATE' AND OLD.kind='attempt'))) OR
 (TG_TABLE_NAME='activity' AND (NEW.kind='exam' OR (TG_OP='UPDATE' AND OLD.kind='exam'))))
 THEN RAISE EXCEPTION 'EXAM_LEGACY_WRITER_BLOCKED' USING ERRCODE='55000'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION farmakon.exam_legacy_write_fence() FROM PUBLIC;
CREATE TRIGGER exam_legacy_fence BEFORE INSERT OR UPDATE ON farmakon.records FOR EACH ROW EXECUTE FUNCTION farmakon.exam_legacy_write_fence();
CREATE TRIGGER exam_event_legacy_fence BEFORE INSERT OR UPDATE ON farmakon.activity FOR EACH ROW EXECUTE FUNCTION farmakon.exam_legacy_write_fence();
ALTER TABLE farmakon.records ENABLE ALWAYS TRIGGER exam_legacy_fence;
ALTER TABLE farmakon.activity ENABLE ALWAYS TRIGGER exam_event_legacy_fence;

-- Reuse the existing deletion lock key and durable job as a tombstone.
CREATE FUNCTION farmakon.exam_deletion_barrier() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text,0));
 IF TG_TABLE_NAME='deletion_jobs' THEN
  PERFORM 1 FROM farmakon.exam_attempts WHERE user_id=NEW.user_id::text;
  PERFORM 1 FROM farmakon.exam_results WHERE user_id=NEW.user_id::text;
 ELSE
  IF EXISTS(SELECT 1 FROM farmakon.deletion_jobs WHERE user_id::text=NEW.user_id::text)
  THEN RAISE EXCEPTION 'ACCOUNT_DELETING' USING ERRCODE='42501'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION farmakon.exam_deletion_barrier() FROM PUBLIC;
CREATE TRIGGER exam_attempt_deletion BEFORE INSERT OR UPDATE ON farmakon.exam_attempts FOR EACH ROW EXECUTE FUNCTION farmakon.exam_deletion_barrier();
CREATE TRIGGER exam_result_deletion BEFORE INSERT OR UPDATE ON farmakon.exam_results FOR EACH ROW EXECUTE FUNCTION farmakon.exam_deletion_barrier();
-- Installation refuses to omit the existing deletion ledger.
CREATE TRIGGER exam_delete_accept BEFORE INSERT ON farmakon.deletion_jobs FOR EACH ROW EXECUTE FUNCTION farmakon.exam_deletion_barrier();
GRANT SELECT,INSERT,UPDATE,DELETE ON farmakon.exam_attempts,farmakon.exam_results TO :"app_role";
GRANT SELECT ON farmakon.exam_store_control TO :"app_role";
CREATE POLICY exam_backend_v1 ON farmakon.exam_attempts TO :"app_role" USING(true) WITH CHECK(true);
CREATE POLICY exam_backend_v1 ON farmakon.exam_results TO :"app_role" USING(true) WITH CHECK(true);
CREATE POLICY exam_backend_v1 ON farmakon.exam_store_control FOR SELECT TO :"app_role" USING(true);
ALTER TABLE farmakon.exam_attempts ENABLE ALWAYS TRIGGER exam_attempt_deletion;
ALTER TABLE farmakon.exam_results ENABLE ALWAYS TRIGGER exam_result_deletion;
ALTER TABLE farmakon.deletion_jobs ENABLE ALWAYS TRIGGER exam_delete_accept;
-- Never grant browser roles or direct child access. Revoke any inherited default ACL.
SELECT format('REVOKE ALL ON %s FROM %I',c.oid::regclass,r.rolname)
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN pg_roles r
WHERE n.nspname='farmakon' AND (c.relname IN ('exam_attempts','exam_results','exam_store_control') OR c.relname ~ '^exam_(attempts|results)_p[0-9]+)
AND r.rolname IN ('anon','authenticated')
\gexec
SELECT format('REVOKE ALL ON %s FROM %I',c.oid::regclass,:'app_role')
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='farmakon' AND (c.relname LIKE 'exam_attempts_p%' OR c.relname LIKE 'exam_results_p%')
\gexec
)
AND r.rolname IN ('anon','authenticated')
\gexec
SELECT format('REVOKE ALL ON %s FROM %I',c.oid::regclass,:'app_role')
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='farmakon' AND (c.relname ~ '^exam_(attempts|results)_p[0-9]+)
\gexec
)
\gexec

CREATE FUNCTION farmakon.exam_new_write_fence() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF (SELECT ready FROM farmakon.exam_store_control WHERE id='exam-v1') IS DISTINCT FROM true
 AND NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='farmakon' AND c.relname='exam_store_control' AND pg_has_role(current_user,c.relowner,'MEMBER'))
 THEN RAISE EXCEPTION 'EXAM_STORE_INACTIVE' USING ERRCODE='55000'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION farmakon.exam_new_write_fence() FROM PUBLIC;
CREATE TRIGGER a_exam_mode BEFORE INSERT OR UPDATE OR DELETE ON farmakon.exam_attempts FOR EACH ROW EXECUTE FUNCTION farmakon.exam_new_write_fence();
CREATE TRIGGER a_exam_mode BEFORE INSERT OR UPDATE OR DELETE ON farmakon.exam_results FOR EACH ROW EXECUTE FUNCTION farmakon.exam_new_write_fence();
ALTER TABLE farmakon.exam_attempts ENABLE ALWAYS TRIGGER a_exam_mode;
ALTER TABLE farmakon.exam_results ENABLE ALWAYS TRIGGER a_exam_mode;
