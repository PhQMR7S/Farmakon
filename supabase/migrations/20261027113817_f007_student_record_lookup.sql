-- F00.7: additive private-table index, tested only on disposable PostgreSQL.
-- No RLS, grants, rows, grading or retention changes. Not applied remotely.
-- Before a future live rollout: validate legacy JSON and choose a reviewed
-- low-traffic/concurrent index build strategy; ordinary CREATE INDEX locks
-- writes during build. Rollback: DROP INDEX farmakon.records_owner_kind_created;
CREATE INDEX IF NOT EXISTS records_owner_kind_created
ON farmakon.records ((data::jsonb->>'userId'),kind,created DESC,id DESC);
