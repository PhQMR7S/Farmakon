\set ON_ERROR_STOP on
\if :{?operator_authorized}
\else
\echo 'BLOCKED: explicit operator authorization required'
SELECT 1/0 AS operator_gate_blocked;
\endif
SELECT :'operator_authorized'='APPROVED' AS authorized
\gset
\if :authorized
\else
SELECT 1/0 AS operator_gate_blocked;
\endif
\if :{?app_role}
\else
\echo 'BLOCKED: app_role required'
SELECT 1/0 AS operator_gate_blocked;
\endif

\if :{?writers_drained}
\else
SELECT 1/0 AS operator_gate_blocked;
\endif

SELECT :'writers_drained'='YES' AS drained_attested
\gset
\if :drained_attested
\else
\echo 'BLOCKED: application maintenance/drain attestation required'
SELECT 1/0 AS operator_gate_blocked;
\endif
BEGIN ISOLATION LEVEL SERIALIZABLE;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='30s';
LOCK TABLE farmakon.records,farmakon.activity,farmakon.deletion_jobs,farmakon.exam_attempts,farmakon.exam_results,farmakon.exam_store_control IN ACCESS EXCLUSIVE MODE;
-- Require visibility into other transactions before accepting a drain check.
SELECT (r.rolsuper OR pg_has_role(current_user,'pg_read_all_stats','MEMBER')) AND NOT EXISTS(
 SELECT 1 FROM pg_stat_activity a WHERE a.pid<>pg_backend_pid() AND a.backend_type='client backend' AND a.xact_start IS NOT NULL
 AND (has_table_privilege(a.usesysid,'farmakon.records','INSERT,UPDATE,DELETE') OR has_table_privilege(a.usesysid,'farmakon.exam_attempts','INSERT,UPDATE,DELETE'))
) AS drain_safe FROM pg_roles r WHERE rolname=current_user
\gset
\if :drain_safe
\else
\echo 'BLOCKED: writer transaction active or drain visibility missing'
SELECT 1/0 AS operator_gate_blocked;
\endif

DO $$ BEGIN
 IF (SELECT ready FROM farmakon.exam_store_control WHERE id='exam-v1') IS DISTINCT FROM true
 OR EXISTS(SELECT 1 FROM farmakon.records WHERE kind='attempt')
 OR EXISTS(SELECT 1 FROM farmakon.activity WHERE kind='exam')
 OR EXISTS(SELECT 1 FROM farmakon.exam_attempts a JOIN farmakon.deletion_jobs j ON j.user_id::text=a.user_id)
 OR EXISTS(SELECT 1 FROM farmakon.exam_results a JOIN farmakon.deletion_jobs j ON j.user_id::text=a.user_id)
 THEN RAISE EXCEPTION 'EXAM_ROLLBACK_STATE_OR_TOMBSTONE'; END IF;
END $$;
UPDATE farmakon.exam_store_control SET ready=false WHERE id='exam-v1';
INSERT INTO farmakon.records SELECT id,kind,course_id,data,created FROM farmakon.exam_attempts;
INSERT INTO farmakon.activity SELECT * FROM farmakon.exam_results;
DO $$ BEGIN
 IF EXISTS((SELECT id,kind,course_id,data,created FROM farmakon.exam_attempts EXCEPT SELECT id,kind,course_id,data,created FROM farmakon.records WHERE kind='attempt')
 UNION ALL (SELECT id,kind,course_id,data,created FROM farmakon.records WHERE kind='attempt' EXCEPT SELECT id,kind,course_id,data,created FROM farmakon.exam_attempts))
 OR EXISTS((SELECT * FROM farmakon.exam_results EXCEPT SELECT * FROM farmakon.activity WHERE kind='exam')
 UNION ALL (SELECT * FROM farmakon.activity WHERE kind='exam' EXCEPT SELECT * FROM farmakon.exam_results))
 THEN RAISE EXCEPTION 'EXAM_ROLLBACK_MISMATCH'; END IF;
END $$;
DELETE FROM farmakon.exam_results;
DELETE FROM farmakon.exam_attempts;
COMMIT;
