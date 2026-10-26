-- STAGING ONLY. Empty isolated project; never run this bootstrap on production.
CREATE SCHEMA farmakon;
SET search_path TO farmakon;
CREATE TABLE activity (
	id text PRIMARY KEY NOT NULL,
	user_id text NOT NULL,
	kind text NOT NULL,
	target text NOT NULL,
	data text NOT NULL,
	updated bigint NOT NULL
);

CREATE UNIQUE INDEX activity_user_target ON activity (user_id,kind,target);
CREATE TABLE codes (
	id text PRIMARY KEY NOT NULL,
	hash text NOT NULL,
	suffix text NOT NULL,
	course_id text NOT NULL,
	days integer NOT NULL,
	expires bigint NOT NULL,
	used_by text,
	used_at bigint
);

CREATE UNIQUE INDEX codes_hash_unique ON codes (hash);
CREATE TABLE enrollments (
	id text PRIMARY KEY NOT NULL,
	email text NOT NULL,
	course_id text NOT NULL,
	expires bigint NOT NULL,
	source text NOT NULL
);

CREATE UNIQUE INDEX enrollment_email_course ON enrollments (email,course_id);
CREATE TABLE members (
	id text PRIMARY KEY NOT NULL,
	email text NOT NULL,
	name text NOT NULL,
	created bigint NOT NULL
);

CREATE TABLE records (
	id text PRIMARY KEY NOT NULL,
	kind text NOT NULL,
	course_id text DEFAULT '' NOT NULL,
	data text NOT NULL,
	created bigint NOT NULL
);

CREATE INDEX records_kind ON records (kind);
CREATE INDEX records_course ON records (course_id);
CREATE TABLE settings (
	id text PRIMARY KEY NOT NULL,
	data text NOT NULL
);

ALTER TABLE records ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON SCHEMA farmakon FROM PUBLIC;
CREATE ROLE farmakon_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
GRANT USAGE ON SCHEMA farmakon TO farmakon_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA farmakon TO farmakon_app;
REVOKE ALL ON ALL TABLES IN SCHEMA farmakon FROM PUBLIC,anon,authenticated;
CREATE POLICY backend_access ON farmakon.records TO farmakon_app USING(true) WITH CHECK(true);
CREATE POLICY backend_access ON farmakon.settings TO farmakon_app USING(true) WITH CHECK(true);
CREATE POLICY backend_access ON farmakon.members TO farmakon_app USING(true) WITH CHECK(true);
CREATE POLICY backend_access ON farmakon.enrollments TO farmakon_app USING(true) WITH CHECK(true);
CREATE POLICY backend_access ON farmakon.codes TO farmakon_app USING(true) WITH CHECK(true);
CREATE POLICY backend_access ON farmakon.activity TO farmakon_app USING(true) WITH CHECK(true);
RESET search_path;
