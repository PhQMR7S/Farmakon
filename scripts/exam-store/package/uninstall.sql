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

BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='30s';
LOCK TABLE farmakon.records,farmakon.activity,farmakon.deletion_jobs,farmakon.exam_attempts,farmakon.exam_results,farmakon.exam_store_control IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
 IF (SELECT ready FROM farmakon.exam_store_control WHERE id='exam-v1') IS DISTINCT FROM false
 OR EXISTS(SELECT 1 FROM farmakon.exam_attempts) OR EXISTS(SELECT 1 FROM farmakon.exam_results)
 THEN RAISE EXCEPTION 'EXAM_UNINSTALL_UNSAFE'; END IF;
END $$;
DROP TRIGGER exam_legacy_fence ON farmakon.records;
DROP TRIGGER exam_event_legacy_fence ON farmakon.activity;
DROP TRIGGER exam_delete_accept ON farmakon.deletion_jobs;
DROP TABLE farmakon.exam_attempts,farmakon.exam_results,farmakon.exam_store_control;
DROP FUNCTION farmakon.exam_legacy_write_fence(),farmakon.exam_deletion_barrier(),farmakon.exam_new_write_fence();
COMMIT;
