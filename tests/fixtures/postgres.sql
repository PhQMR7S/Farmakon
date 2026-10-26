-- TEST FIXTURE ONLY: column/index contract verified against linked Supabase on 2026-10-26.
-- Not a production migration. No real users or course data.
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