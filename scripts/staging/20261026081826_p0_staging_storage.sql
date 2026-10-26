-- STAGING ONLY: qfzharpouemueipsrduv. Keep outside automatic production migrations.
-- Requires the reviewed farmakon baseline. Configure storage-owner separately;
-- no account email or credential is embedded in this script. Never copy real media.
CREATE FUNCTION farmakon.storage_is_owner() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS (
  SELECT 1 FROM farmakon.settings s WHERE s.id='storage-owner'
  AND lower(s.data::jsonb->>'email')=lower((SELECT auth.jwt()->>'email'))
 );
$$;
CREATE FUNCTION farmakon.farmakon_can_read_asset(asset_name text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS (
  SELECT 1 FROM farmakon.records r JOIN farmakon.records c ON c.id=r.course_id
  WHERE r.kind IN ('lesson','file') AND c.kind='course'
  AND r.data::jsonb->>'assetId'=asset_name
  AND r.data::jsonb->>'status'='published' AND c.data::jsonb->>'status'='published'
  AND ((r.data::jsonb->>'free')='true' OR EXISTS (
   SELECT 1 FROM farmakon.enrollments e WHERE e.course_id=r.course_id
   AND lower(e.email)=lower((SELECT auth.jwt()->>'email'))
   AND e.expires>extract(epoch from now())*1000
  ))
 );
$$;
REVOKE ALL ON FUNCTION farmakon.storage_is_owner() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION farmakon.farmakon_can_read_asset(text) FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA farmakon TO authenticated;
GRANT EXECUTE ON FUNCTION farmakon.storage_is_owner() TO authenticated;
GRANT EXECUTE ON FUNCTION farmakon.farmakon_can_read_asset(text) TO authenticated;
-- No direct table grants to browser roles. The two boolean helpers deliberately
-- mediate private-schema lookups for Storage RLS; neither returns row data.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('farmakon','farmakon',false,52428800,
 ARRAY['application/pdf','video/mp4','video/webm','audio/mpeg','image/png','image/jpeg']);
CREATE POLICY farmakon_owner_upload ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='farmakon' AND farmakon.storage_is_owner());
CREATE POLICY farmakon_authenticated_read ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='farmakon' AND (farmakon.storage_is_owner() OR farmakon.farmakon_can_read_asset(name)));
-- No UPDATE/DELETE policy: the application uploads unique IDs with upsert=false.
