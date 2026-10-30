-- TEST/PREPARED DDL ONLY. Never in the automatically applied migration directory.
-- Requires an isolated fixture or separately approved installation and cutover.
BEGIN;
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
REVOKE ALL ON ALL TABLES IN SCHEMA farmakon FROM PUBLIC;
-- Parent and child relations have no public client privileges; child RLS is enabled too.
DO $$ DECLARE t text; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='farmakon' AND (tablename LIKE 'exam_attempts_p%' OR tablename LIKE 'exam_results_p%') LOOP
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
COMMIT;
