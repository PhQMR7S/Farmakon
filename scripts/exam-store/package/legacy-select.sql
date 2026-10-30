WITH raw_attempts AS (
 SELECT id,CASE WHEN pg_input_is_valid(data,'jsonb') THEN data::jsonb ELSE NULL END d
 FROM farmakon.records WHERE kind='attempt'
), attempts AS (
 SELECT *,d->>'userId' u,d->>'examId' ex,d->>'status' status FROM raw_attempts
), events AS (
 SELECT user_id,target,CASE WHEN pg_input_is_valid(data,'jsonb') THEN data::jsonb ELSE NULL END d
 FROM farmakon.activity WHERE kind='exam'
), role_info AS (
 SELECT oid,rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb AS unsafe
 FROM pg_roles WHERE rolname=:'app_role'
), issues AS (
 SELECT 'invalid_attempt_json' name,count(*)::bigint n FROM attempts WHERE d IS NULL OR jsonb_typeof(d)<>'object'
 UNION ALL SELECT 'missing_attempt_identity',count(*) FROM attempts WHERE coalesce(u,'')='' OR coalesce(ex,'')=''
 UNION ALL SELECT 'invalid_attempt_status',count(*) FROM attempts WHERE status IS NULL OR status NOT IN ('active','done')
 UNION ALL SELECT 'invalid_answers',count(*) FROM attempts WHERE d ? 'answers' AND jsonb_typeof(d->'answers')<>'object'
 UNION ALL SELECT 'missing_questions_snapshot',count(*) FROM attempts WHERE coalesce(jsonb_typeof(d->'questions'),'null')<>'array'
 UNION ALL SELECT 'invalid_done_result',count(*) FROM attempts WHERE status='done' AND (coalesce(jsonb_typeof(d->'result'),'null')<>'object' OR coalesce(jsonb_typeof(d->'result'->'score'),'null')<>'number' OR coalesce(jsonb_typeof(d->'result'->'total'),'null')<>'number')
 UNION ALL SELECT 'duplicate_active_groups',count(*) FROM (SELECT u,ex FROM attempts WHERE status='active' GROUP BY u,ex HAVING count(*)>1) dup
 UNION ALL SELECT 'deleted_identity_attempts',count(*) FROM attempts a WHERE EXISTS(SELECT 1 FROM farmakon.deletion_jobs j WHERE j.user_id::text=a.u)
 UNION ALL SELECT 'invalid_event_json',count(*) FROM events WHERE d IS NULL OR jsonb_typeof(d)<>'object'
 UNION ALL SELECT 'orphan_or_foreign_result_events',count(*) FROM events e WHERE NOT EXISTS(SELECT 1 FROM attempts a WHERE a.id=e.target AND a.u=e.user_id AND a.status='done')
 UNION ALL SELECT 'missing_backend_role',CASE WHEN EXISTS(SELECT 1 FROM role_info) THEN 0 ELSE 1 END
 UNION ALL SELECT 'privileged_backend_role',count(*) FROM role_info WHERE unsafe
 UNION ALL SELECT 'backend_owns_source',count(*) FROM role_info r WHERE EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='farmakon' AND c.relname IN ('records','activity') AND pg_has_role(r.oid,c.relowner,'MEMBER'))
 UNION ALL SELECT 'public_source_write_grants',count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(c.relacl) acl WHERE n.nspname='farmakon' AND c.relname IN ('records','activity') AND acl.grantee=0 AND acl.privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE')
)
SELECT jsonb_build_object(
 'scope','legacy preflight aggregates only; not migration approval',
 'attempt_count',(SELECT count(*) FROM attempts),
 'exam_event_count',(SELECT count(*) FROM events),
 'status',CASE WHEN EXISTS(SELECT 1 FROM issues WHERE n>0) THEN 'BLOCKED' ELSE 'PASS' END,
 'issues',(SELECT jsonb_object_agg(name,n ORDER BY name) FROM issues)
)
\gset
