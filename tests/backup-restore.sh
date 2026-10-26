#!/usr/bin/env bash
# Synthetic PostgreSQL drill only; never accepts a connection URL or production data.
set -euo pipefail
: "${FARMAKON_TEST_CONTAINER:?CI must supply the disposable postgres service container}"
[[ "${GITHUB_ACTIONS:-}" == true ]] || { echo 'CI-only fixture drill' >&2; exit 1; }
[[ "$FARMAKON_TEST_CONTAINER" =~ ^[a-f0-9]{12,64}$ ]] || exit 1
database_name=$(docker exec "$FARMAKON_TEST_CONTAINER" psql -U farmakon_test -d farmakon_v2_test -Atc 'select current_database()')
[[ "$database_name" == farmakon_v2_test ]] || exit 1
docker exec -i "$FARMAKON_TEST_CONTAINER" psql -U farmakon_test -d farmakon_v2_test -v ON_ERROR_STOP=1 <<'SQL'
CREATE SCHEMA restore_probe;
CREATE TABLE restore_probe.progress (id text PRIMARY KEY, payload jsonb NOT NULL, updated bigint NOT NULL);
INSERT INTO restore_probe.progress VALUES ('student-fixture','{"note":"ملاحظة اختبار","seconds":45,"completed":false}',1790000000000);
SQL
before=$(docker exec "$FARMAKON_TEST_CONTAINER" psql -U farmakon_test -d farmakon_v2_test -Atc "select md5(string_agg(id||payload::text||updated::text,',' order by id)) from restore_probe.progress")
docker exec "$FARMAKON_TEST_CONTAINER" pg_dump -U farmakon_test -d farmakon_v2_test --schema=restore_probe --no-owner --no-acl --file=/tmp/farmakon-restore-probe.sql
docker exec "$FARMAKON_TEST_CONTAINER" createdb -U farmakon_test farmakon_restore_test
docker exec "$FARMAKON_TEST_CONTAINER" psql -U farmakon_test -d farmakon_restore_test -v ON_ERROR_STOP=1 --file=/tmp/farmakon-restore-probe.sql
after=$(docker exec "$FARMAKON_TEST_CONTAINER" psql -U farmakon_test -d farmakon_restore_test -Atc "select md5(string_agg(id||payload::text||updated::text,',' order by id)) from restore_probe.progress")
[[ -n "$before" && "$before" == "$after" ]]
echo 'PASS: pg_dump/psql restore to a separate disposable database; Arabic JSON and bigint checksum preserved. No production backup was accessed.'
