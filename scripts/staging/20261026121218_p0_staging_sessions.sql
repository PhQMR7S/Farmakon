-- STAGING ONLY: qfzharpouemueipsrduv; requires the baseline farmakon_app role.
-- Backend-only boolean lookup. Never grant direct Auth table access to the app.
CREATE FUNCTION farmakon.session_is_active(session_id uuid,expected_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS(SELECT 1 FROM auth.sessions s WHERE s.id=session_id
  AND s.user_id=expected_user_id AND (s.not_after IS NULL OR s.not_after>now()));
$$;
REVOKE ALL ON FUNCTION farmakon.session_is_active(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION farmakon.session_is_active(uuid,uuid) TO farmakon_app;
-- Storage validates the JWT itself, but must also reject an already-revoked
-- session. This self-only wrapper exposes no arbitrary session/user lookup.
CREATE FUNCTION farmakon.storage_session_is_active() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT CASE WHEN auth.uid() IS NOT NULL AND
  (SELECT auth.jwt()->>'session_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 THEN farmakon.session_is_active((SELECT auth.jwt()->>'session_id')::uuid,auth.uid()) ELSE false END;
$$;
REVOKE ALL ON FUNCTION farmakon.storage_session_is_active() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION farmakon.storage_session_is_active() TO authenticated;
CREATE POLICY farmakon_active_storage_session ON storage.objects AS RESTRICTIVE
FOR ALL TO authenticated
USING(bucket_id<>'farmakon' OR farmakon.storage_session_is_active())
WITH CHECK(bucket_id<>'farmakon' OR farmakon.storage_session_is_active());
-- Enable FARMAKON_STRICT_SESSIONS_ENABLED only after applying and verifying this
-- helper. Its presence check detects logout/revocation; it is not an idle timer.
