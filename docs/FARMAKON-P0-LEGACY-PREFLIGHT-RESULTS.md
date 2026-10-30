# Farmakon P0.9 — read-only legacy preflight
30 October 2026. PR #19; baseline fed565c.
**PASS: 14 isolated PostgreSQL checks. No live inventory or release approval.**

Implementation: [f69fe6c5d861328b53ad8de22068aeb979407978](https://github.com/PhQMR7S/Farmakon/commit/f69fe6c5d861328b53ad8de22068aeb979407978).
[Actions 41088572166 SUCCESS](https://github.com/PhQMR7S/Farmakon/actions/runs/41088572166); [evidence](evidence/P0.9-LEGACY-PREFLIGHT.json).

## Deliverable
[scripts/exam-store/legacy-preflight.sql](../scripts/exam-store/legacy-preflight.sql) runs a REPEATABLE READ READ ONLY transaction, bounded by 15s statement and 2s lock timeouts, and rolls back. It emits aggregate counts and PASS/BLOCKED only, without identifiers, emails, answer payloads or grades. A quoted psql app_role parameter selects the backend role to inspect. Missing required source/ledger relations cause SQL failure, not approval.

It detects malformed JSON without casting crashes; missing user/exam identity; invalid status, answer/snapshot/result shapes; duplicate active groups; attempts belonging to deletion-job identities; invalid or foreign/orphan result events; absent or privileged backend roles; effective source-table ownership; and PUBLIC source write grants.

It does not repair, delete, choose a winning attempt, regrade, set readiness, install DDL, enable the flag, or make role changes. PASS is only absence of these specific blockers in the inspected snapshot: it is not full semantic validation of every JSON field, a complete privilege/role-membership audit, partition-grant certification, a provider RLS/JWT test, or migration approval. Further value-range and operational consistency checks may be needed for actual legacy formats; no assumption is made about unseen real data.

## Actual tests
[tests/legacy-preflight-p09.py](../tests/legacy-preflight-p09.py) uses only a disposable PostgreSQL 17 Docker service and fixture tables. Fourteen checks PASS: healthy data is unchanged; output is aggregate-only; malformed JSON blocks; duplicates remain untouched; invalid identity/snapshot/answers/result block; durable deletion ledger blocks; cross-user event links block; missing/BYPASSRLS/owner backend roles block; public writes block; clean state is restored by test setup; PostgreSQL rejects DELETE in a read-only transaction (25006); schema/role cleanup succeeds. Container/network cleanup is recorded in the successful job.

No environment or source-service credentials were used. No Production/Staging/Drive or actual student data were read or changed. P0.5/P0.6/P0.8 workflows and HTTP loads were not rerun.

[Quality 41088580657](https://github.com/PhQMR7S/Farmakon/actions/runs/41088580657): scope PASS, existing load gate FAIL, unchanged baseline/postgres/browser SKIPPED. Exact read-only tool/test/document paths were added to the existing tooling-only allowlist; no runtime exemptions were broadened.

## Remaining
P0.8's specialized flag remains disabled; historical F00 gate is OPEN. Actual legacy inventory, real installation-role mapping, complete operational migration/rollback review and Auth/Storage/DR are not proven by synthetic preflight success. No migration/cutover, merge/deployment or paid service was performed. This task supplies an executed, tested preflight tool for that review; it does not authorize its use against a real service or open a new stage.
