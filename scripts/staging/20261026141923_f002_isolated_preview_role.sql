-- STAGING ONLY: qfzharpouemueipsrduv, applied through the connected provider.
-- Operational passwords are set separately and never belong in migration history.
-- Do not add this to automatic production migrations.
CREATE ROLE farmakon_f002_preview NOLOGIN INHERIT NOSUPERUSER NOCREATEDB
 NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 3
 VALID UNTIL '2026-11-02 23:59:59+00' IN ROLE farmakon_app;
-- A separate secret-only credential operation enabled LOGIN for the isolated
-- Vercel branch. No superuser, Auth-table SELECT, role/database creation or RLS bypass.
-- Rollback after disabling the isolated preview:
-- ALTER ROLE farmakon_f002_preview NOLOGIN;
-- REVOKE farmakon_app FROM farmakon_f002_preview;
-- Keep production/default variables unchanged; never remove isolation overrides
-- while automatic preview deployment could inherit production settings.
