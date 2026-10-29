# Farmakon P0.8 — specialized exam runtime: implemented and tested
29 October 2026. PR #19, based on 07e9b67.

**PASS within isolated scope: 18 safety checks; specialized 410/410 actual HTTP 200 across 1/5/10/25 VU. Not a Production cutover or complete F00 closure.**

Runtime checkpoint: [40b69a0](https://github.com/PhQMR7S/Farmakon/commit/40b69a00c6b1f2df329badcb944bfc94e9dac278), including prior implementation and export correction.
HTTP harness checkpoint: [883d368](https://github.com/PhQMR7S/Farmakon/commit/883d36891a7452c3d08a19f7b83dbe43939a2c70).
[Safety Actions 40849622593](https://github.com/PhQMR7S/Farmakon/actions/runs/40849622593) PASS.
[HTTP comparison Actions 40850263098](https://github.com/PhQMR7S/Farmakon/actions/runs/40850263098) PASS, including both measured modes and cleanup.
[Regression Actions 40849629651](https://github.com/PhQMR7S/Farmakon/actions/runs/40849629651): baseline PASS, browser PASS; PostgreSQL functional/security steps PASS, job FAIL solely at the retained prior SSI gate. That gate is not silently cleared.

## Actual application change
- FARMAKON_EXAM_STORE_ENABLED is false unless explicitly true. Enabling it with VERCEL_ENV=production is explicitly rejected pending release approval.
- server.ts reads attempts using both verified user ID and attempt ID, with partition pruning by user_id; start/resume/answer/GET use the specialized owner-scoped list.
- write('attempt') targets exam_attempts, and finishExam writes the event to exam_results in the same original SERIALIZABLE transaction. Five attempts and uncertain-COMMIT handling remain unchanged.
- Attempts and result events each use 32 hash partitions by user_id, taking the existing P0.2 evidence as the selected candidate rather than repeating its architecture study. Their full historical JSON remains intact; no retroactive regrade or deadline change.
- The original records catalogue and progress activity stay separate from exam writes. GET combines generic progress with specialized exam events.
- Actual export uses the same specialized source for size checks and downloaded rows. Actual purge removes specialized data inside its existing transaction.
- Durable deletion-job barriers cover new attempt/result INSERT/UPDATE and acceptance read sets, using the existing per-user deletion lock key. A stale authenticated free-exam request cannot recreate a purged attempt after acceptance.
- Duplicate legacy active attempts are not deleted or merged: start refuses ambiguous groups with 409. No partial unique active index is imposed over old data.
- The production database adapter checks control state after BEGIN and before application work; disabling/removing the flag while the control row is ready rejects the transaction instead of reading stale legacy data.
- Prepared DDL is only in tests/fixtures/exam-store-p08.sql, not in automatic migrations. No application endpoint installs it. Roles/grants for any real installation still require review; the test applies explicit limited-login RLS policies only in the disposable database.

## Safety execution
[Detailed evidence](evidence/P0.8-EXAM-STORE.json). 18 PASS checks on PostgreSQL 17.11 include:
limited real LOGIN + RLS; concurrent starts/patches/submissions; cross-user denial; frozen results; exact legacy JSON/IDs/created preservation; specialized-only writes; CHECK failure in result writing rolls back the attempt update, answers and event; successful retry commits once; GET deadline settlement; actual export without answer keys; actual purge; stale-writer rejection; guarded flag disable; restoring retained JSON during fixture rollback; schema/role cleanup.

The existing handler/server/database code is loaded from repository source. Only Auth identity/rate transport and local database URL/TLS are fixture injections. No test adapter redirects exam SQL. Safety transport calls handlers directly; the separate load below uses a real HTTP socket.

The rollback test restores remaining specialized rows to legacy under exclusive locks in a single transaction, sets readiness false and then disables the flag. One retained completed owner attempt proves restoration is nonempty and byte-for-byte. This is a synthetic rollback procedure, not approval or proof for an online real-data migration. Old application binaries must not be deployed before the separately reviewed data rollback completes; the source write fence rejects old attempt/event writes while specialized readiness is true.

## Actual HTTP comparison
Same runner, separate fresh schema per mode; PostgreSQL 17.11, 750 synthetic registered students, 1500 old completed attempts, same 4 courses/catalogue. Actual Node HTTP server bound to loopback, fetch clients, original handlers and production SQL adapter. Auth/rate are fixtures; no live Supabase/Vercel capacity claim. The load fixture uses its administrative bootstrap identity; limited-login/RLS behavior is validated separately in safety tests.

Two rounds per virtual user: dashboard → start → save → submit → result reload. Protected-media fixture was omitted, so expected successful request counts are 10/50/100/250. This intentionally differs from the older six-operation benchmark; compare the two modes here, not old total request counts.

| VU | Legacy requests / final errors | Legacy 40001 retries | Specialized HTTP 200 / errors | Specialized retries | Specialized P95 ms |
|---:|---:|---:|---:|---:|---:|
| 1 | 10 / 0 | 0 | 10 / 0 | 0 | 49.4 |
| 5 | 50 / 0 | 9 | 50 / 0 | 3 | 71.81 |
| 10 | 100 / 0 | 27 | 100 / 0 | 1 | 64.39 |
| 25 | 234 / 2 | 86 | 250 / 0 | 1 | 132.71 |

Legacy recorded two startExam HTTP 503 / SQLSTATE 40001 at 25 VU and stopped escalation; 394 total requests, 392 HTTP 200, 124 actual 40001 aborts (122 retries plus two exhausted final failures). Specialized completed all 410 requests, 410 HTTP 200, 5 actual 40001 aborts, all recovered by the unchanged retry policy. Final-error requestOutcomes and bounded traces remain in the raw evidence; no failed response was hidden.

The specialized run still has legitimate SSI aborts; this does not claim their complete elimination. Recorded abort counts fell from 124 to 5 in these observed workloads. Legacy performed fewer total operations due to its safe stop, so the raw totals are not a guaranteed rate/capacity estimate or proof of all future executions. At 25 VU: legacy P95 414.97 ms vs specialized 132.71 ms in this sample.

All successful saves were checked against submitted score=1; GET checks owner scope and hidden answer keys. End-of-run SQL asserts no duplicate active student/exam groups or result-event groups. Safety tests additionally cover concurrent patches and exact immutable results. Limits remain zero unexpected final HTTP errors, P95 5000ms and RSS 768MiB, with stop after a failed level. Connection acquire/release counters are balanced: specialized 415/415, legacy 516/516. Detailed trace samples are bounded; their dropped-event counters are retained. No complete graph for every query is claimed.

Raw evidence: [legacy](evidence/P0.8-HTTP-LEGACY.json), [specialized](evidence/P0.8-HTTP-SPECIALIZED.json).

## Corrections and CI disclosure
Initial fixture startup failed from SQL dollar quoting; corrected before a complete safety run. Safety then caught an actual export regression (counting specialized rows while downloading legacy only); corrected in 887168a. The stale-request test originally stopped at the deleted entitlement (403); its free-exam fixture was adjusted to reach and verify the database barrier, rather than mislabel that early denial as barrier coverage. The HTTP harness first failed before load due to its moved helper import; corrected in 883d368. These failed attempts are retained in Actions; none is counted as a passing workload.

Full regression was rerun because runtime changed. Earlier superseded quality runs were cancelled, not counted as passes. The completed regression checkpoint is 40849629651. Subsequent exact HTTP-tooling-only deltas are scoped from 40b69a0 to avoid rerunning unchanged suites; the old load gate stays visibly failed in quality. P0.5/P0.6 workflows were not rerun.

Existing pg warning about parallel client.query in GET remains visible; no test-only serialization workaround, dependency upgrade, or pg9 compatibility claim is introduced.

## Remaining gates
Feature flag remains disabled; no live schema, student data, Production/Staging, Drive, migration/cutover, merge/deployment, or paid service changed. The implementation is available for review inside PR #19.

This establishes a working specialized application path and measured isolated improvement. It does not close provider Auth/Storage/DR gates, inventory every real legacy anomaly, validate unknown network COMMIT outcomes, or authorize installation/cutover. Real role/grant mapping, complete legacy inventory and a separately reviewed operational migration/rollback procedure are required before any enablement. No next stage was opened.
