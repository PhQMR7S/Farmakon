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
LOCK TABLE farmakon.records,farmakon.activity,farmakon.deletion_jobs IN SHARE ROW EXCLUSIVE MODE;
SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=:'app_role' AND NOT (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb))
 AND NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='farmakon' AND c.relname IN ('records','activity','deletion_jobs')
 AND pg_has_role(:'app_role',c.relowner,'MEMBER'))
 AND NOT EXISTS(SELECT 1 FROM pg_roles r WHERE (r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb) AND pg_has_role(:'app_role',r.oid,'MEMBER'))
 AND NOT pg_has_role(:'app_role',current_user,'MEMBER')
 AND NOT has_schema_privilege(:'app_role','farmakon','CREATE')
 AND NOT has_table_privilege(:'app_role','farmakon.records','TRUNCATE')
 AND NOT has_table_privilege(:'app_role','farmakon.activity','TRUNCATE')
 AND to_regclass('farmakon.exam_store_control') IS NULL AS role_safe
\gset
\if :role_safe
\else
\echo 'BLOCKED: unsafe backend or existing installation'
SELECT 1/0 AS operator_gate_blocked;
\endif
\ir schema.sql
COMMIT;
