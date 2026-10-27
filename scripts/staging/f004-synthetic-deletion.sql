-- MANUAL STAGING/LOCAL TEST ONLY. Never in automatic production migrations.
-- No grants on auth or storage tables; worker credentials are separate.
CREATE TABLE farmakon.deletion_jobs (
 user_id uuid PRIMARY KEY, email text NOT NULL,
 policy text NOT NULL CHECK(policy='synthetic-v1'),
 state text NOT NULL DEFAULT 'accepted' CHECK(state IN ('accepted','sessions_revoked','files_removed','data_removed','complete')),
 lease uuid, attempts integer NOT NULL DEFAULT 0,
 created bigint NOT NULL, updated bigint NOT NULL
);
ALTER TABLE farmakon.deletion_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON farmakon.deletion_jobs FROM PUBLIC,anon,authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='farmakon_app') THEN
  GRANT SELECT,INSERT,UPDATE ON farmakon.deletion_jobs TO farmakon_app;
  CREATE POLICY backend_access ON farmakon.deletion_jobs TO farmakon_app USING(true) WITH CHECK(true);
 END IF;
END $$;
-- Tombstones intentionally survive fixture Auth deletion. Before restoring an old
-- backup, merge the newest tombstones into quarantine, purge restored identities
-- and sessions, then reopen access. Never restore directly over a live project.

-- Requires reviewed Staging storage-owner setting and provider schemas.
-- Do not grant to public clients. No direct Auth table permission is granted.
CREATE FUNCTION farmakon.require_synthetic_deletion(uid uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM auth.users u JOIN farmakon.deletion_jobs j ON j.user_id=u.id
  WHERE u.id=uid AND j.email=u.email AND j.policy='synthetic-v1'
  AND u.raw_app_meta_data->>'farmakon_test_fixture'='true'
  AND u.email ~ '^f004-delete-[a-z0-9-]+@example\.test$'
  AND EXISTS(SELECT 1 FROM farmakon.settings s WHERE s.id='storage-owner'
    AND lower(s.data::jsonb->>'email')<>lower(u.email))) THEN
  RAISE EXCEPTION 'DELETION_SCOPE';
 END IF;
END $$;
CREATE FUNCTION farmakon.revoke_synthetic_sessions(uid uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM farmakon.require_synthetic_deletion(uid);
 DELETE FROM auth.sessions WHERE user_id=uid;
END $$;
CREATE FUNCTION farmakon.synthetic_owned_files(uid uuid) RETURNS TABLE(name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM farmakon.require_synthetic_deletion(uid);
 IF EXISTS(SELECT 1 FROM farmakon.records a JOIN farmakon.records r
  ON r.data::jsonb->>'assetId'=a.id
  WHERE a.kind='asset' AND a.data::jsonb->>'owner'=uid::text)
 OR EXISTS(SELECT 1 FROM storage.objects o JOIN farmakon.records r ON r.data::jsonb->>'assetId'=o.name
  WHERE o.bucket_id='farmakon' AND o.owner_id=uid::text)
 OR EXISTS(SELECT 1 FROM storage.objects WHERE owner_id=uid::text AND bucket_id<>'farmakon') THEN
  RAISE EXCEPTION 'DELETION_SHARED_OR_UNKNOWN_STORAGE';
 END IF;
 RETURN QUERY SELECT o.name FROM storage.objects o WHERE o.bucket_id='farmakon' AND o.owner_id=uid::text;
END $$;
REVOKE ALL ON FUNCTION farmakon.require_synthetic_deletion(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION farmakon.revoke_synthetic_sessions(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION farmakon.synthetic_owned_files(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION farmakon.revoke_synthetic_sessions(uuid),farmakon.synthetic_owned_files(uuid) TO farmakon_app;
-- Storage's existing restrictive policy delegates to this helper too.
CREATE OR REPLACE FUNCTION farmakon.session_is_active(session_id uuid,expected_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT NOT EXISTS(SELECT 1 FROM farmakon.deletion_jobs j WHERE j.user_id=expected_user_id)
 AND EXISTS(SELECT 1 FROM auth.sessions s WHERE s.id=session_id
 AND s.user_id=expected_user_id AND (s.not_after IS NULL OR s.not_after>now()));
$$;

-- Serialize acceptance with in-flight personal writes, so an earlier verified
-- request cannot recreate study/profile rows after deletion begins.
CREATE FUNCTION farmakon.deletion_write_barrier() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE value text; keys text[]; payload jsonb;
BEGIN
 IF TG_TABLE_NAME='deletion_jobs' THEN
  keys:=ARRAY[NEW.user_id::text,lower(NEW.email)];
 ELSIF TG_TABLE_NAME='members' THEN keys:=ARRAY[NEW.id,lower(NEW.email)];
 ELSIF TG_TABLE_NAME='activity' THEN keys:=ARRAY[NEW.user_id];
 ELSIF TG_TABLE_NAME='enrollments' THEN keys:=ARRAY[lower(NEW.email)];
 ELSIF TG_TABLE_NAME='codes' THEN keys:=ARRAY[lower(NEW.used_by)];
 ELSE
  payload:=NEW.data::jsonb;
  keys:=ARRAY[payload->>'userId',payload->>'owner',lower(payload->>'email'),lower(payload->>'user')];
  IF TG_OP='UPDATE' THEN
   payload:=OLD.data::jsonb;
   keys:=keys||ARRAY[payload->>'userId',payload->>'owner',lower(payload->>'email'),lower(payload->>'user')];
  END IF;
 END IF;
 FOR value IN SELECT DISTINCT v FROM unnest(keys) v WHERE v IS NOT NULL ORDER BY v LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended(value,0));
  IF TG_TABLE_NAME<>'deletion_jobs' AND EXISTS(SELECT 1 FROM farmakon.deletion_jobs j WHERE j.user_id::text=value OR lower(j.email)=value) THEN
   RAISE EXCEPTION 'ACCOUNT_DELETING' USING ERRCODE='42501';
  END IF;
 END LOOP;
 IF TG_TABLE_NAME='deletion_jobs' THEN
  -- Predicate reads participate in SSI with personal transactions that began
  -- before acceptance. Acceptance itself must use SERIALIZABLE.
  PERFORM 1 FROM farmakon.members WHERE id=NEW.user_id::text OR lower(email)=lower(NEW.email);
  PERFORM 1 FROM farmakon.activity WHERE user_id=NEW.user_id::text;
  PERFORM 1 FROM farmakon.enrollments WHERE lower(email)=lower(NEW.email);
  PERFORM 1 FROM farmakon.codes WHERE lower(used_by)=lower(NEW.email);
  PERFORM 1 FROM farmakon.records WHERE data::jsonb->>'userId'=NEW.user_id::text OR data::jsonb->>'owner'=NEW.user_id::text OR lower(data::jsonb->>'email')=lower(NEW.email) OR lower(data::jsonb->>'user')=lower(NEW.email);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION farmakon.deletion_write_barrier() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER deletion_accept_barrier BEFORE INSERT ON farmakon.deletion_jobs FOR EACH ROW EXECUTE FUNCTION farmakon.deletion_write_barrier();
CREATE TRIGGER deletion_member_barrier BEFORE INSERT OR UPDATE ON farmakon.members FOR EACH ROW EXECUTE FUNCTION farmakon.deletion_write_barrier();
CREATE TRIGGER deletion_activity_barrier BEFORE INSERT OR UPDATE ON farmakon.activity FOR EACH ROW EXECUTE FUNCTION farmakon.deletion_write_barrier();
CREATE TRIGGER deletion_enrollment_barrier BEFORE INSERT OR UPDATE ON farmakon.enrollments FOR EACH ROW EXECUTE FUNCTION farmakon.deletion_write_barrier();
CREATE TRIGGER deletion_record_barrier BEFORE INSERT OR UPDATE ON farmakon.records FOR EACH ROW EXECUTE FUNCTION farmakon.deletion_write_barrier();
CREATE TRIGGER deletion_code_barrier BEFORE INSERT OR UPDATE ON farmakon.codes FOR EACH ROW EXECUTE FUNCTION farmakon.deletion_write_barrier();
