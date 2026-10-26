-- Additive, private metadata only. Production application requires explicit release approval.
CREATE TABLE farmakon.rate_limits (
 key text PRIMARY KEY,
 count integer NOT NULL CHECK (count>0),
 reset_at bigint NOT NULL
);
CREATE INDEX rate_limits_reset ON farmakon.rate_limits(reset_at);
ALTER TABLE farmakon.rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON farmakon.rate_limits FROM PUBLIC,anon,authenticated;
DO $policy$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='farmakon_app') THEN
  GRANT SELECT,INSERT,UPDATE,DELETE ON farmakon.rate_limits TO farmakon_app;
  CREATE POLICY backend_access ON farmakon.rate_limits TO farmakon_app USING(true) WITH CHECK(true);
 END IF;
END $policy$;
