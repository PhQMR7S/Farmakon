-- TEST ONLY. Installed into a fresh, explicitly opted-in PostgreSQL container.
-- No production migration, backfill, cutover, or application reader change.
BEGIN;
CREATE ROLE p05_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE p05_mirror NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE p05_writer LOGIN PASSWORD 'p05-fixture-only' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE SCHEMA p05 AUTHORIZATION p05_owner;
REVOKE ALL ON SCHEMA p05 FROM PUBLIC;
GRANT USAGE ON SCHEMA p05 TO p05_writer,p05_mirror;
SET LOCAL ROLE p05_owner;
CREATE TABLE p05.records(id text PRIMARY KEY,kind text NOT NULL,course_id text NOT NULL DEFAULT '',data text NOT NULL,created bigint NOT NULL);
CREATE TABLE p05.activity(id text PRIMARY KEY,user_id text NOT NULL,kind text NOT NULL,target text NOT NULL,data text NOT NULL,updated bigint NOT NULL,UNIQUE(user_id,kind,target));
CREATE TABLE p05.attempt_shadow(LIKE p05.records INCLUDING ALL);
CREATE TABLE p05.event_shadow(LIKE p05.activity INCLUDING ALL);
ALTER TABLE p05.attempt_shadow ADD CONSTRAINT attempt_kind CHECK(kind='attempt');
ALTER TABLE p05.event_shadow ADD CONSTRAINT event_kind CHECK(kind='exam');
ALTER TABLE p05.records ENABLE ROW LEVEL SECURITY;
ALTER TABLE p05.activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE p05.attempt_shadow ENABLE ROW LEVEL SECURITY;
ALTER TABLE p05.event_shadow ENABLE ROW LEVEL SECURITY;
CREATE POLICY writer ON p05.records TO p05_writer USING(true) WITH CHECK(true);
CREATE POLICY writer ON p05.activity TO p05_writer USING(true) WITH CHECK(true);
CREATE POLICY mirror ON p05.attempt_shadow TO p05_mirror USING(true) WITH CHECK(true);
CREATE POLICY mirror ON p05.event_shadow TO p05_mirror USING(true) WITH CHECK(true);
GRANT SELECT,INSERT,UPDATE,DELETE ON p05.records,p05.activity TO p05_writer;
GRANT SELECT,INSERT,UPDATE,DELETE ON p05.attempt_shadow,p05.event_shadow TO p05_mirror;
RESET ROLE;
-- Limited function owner can write shadow only. It owns neither source tables nor schema.
CREATE FUNCTION p05.mirror_attempt() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP<>'INSERT' AND OLD.kind='attempt' THEN
  DELETE FROM p05.attempt_shadow WHERE id=OLD.id;
 END IF;
 IF TG_OP<>'DELETE' AND NEW.kind='attempt' THEN
  INSERT INTO p05.attempt_shadow(id,kind,course_id,data,created)
   VALUES(NEW.id,NEW.kind,NEW.course_id,NEW.data,NEW.created);
 END IF;
 RETURN NULL;
END $$;
CREATE FUNCTION p05.mirror_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP<>'INSERT' AND OLD.kind='exam' THEN
  DELETE FROM p05.event_shadow WHERE id=OLD.id;
 END IF;
 IF TG_OP<>'DELETE' AND NEW.kind='exam' THEN
  INSERT INTO p05.event_shadow(id,user_id,kind,target,data,updated)
   VALUES(NEW.id,NEW.user_id,NEW.kind,NEW.target,NEW.data,NEW.updated);
 END IF;
 RETURN NULL;
END $$;
ALTER FUNCTION p05.mirror_attempt() OWNER TO p05_mirror;
ALTER FUNCTION p05.mirror_event() OWNER TO p05_mirror;
REVOKE ALL ON FUNCTION p05.mirror_attempt(),p05.mirror_event() FROM PUBLIC,p05_writer;
CREATE TRIGGER mirror_attempt AFTER INSERT OR UPDATE OR DELETE ON p05.records FOR EACH ROW EXECUTE FUNCTION p05.mirror_attempt();
CREATE TRIGGER mirror_event AFTER INSERT OR UPDATE OR DELETE ON p05.activity FOR EACH ROW EXECUTE FUNCTION p05.mirror_event();
ALTER TABLE p05.records ENABLE ALWAYS TRIGGER mirror_attempt;
ALTER TABLE p05.activity ENABLE ALWAYS TRIGGER mirror_event;
COMMIT;
