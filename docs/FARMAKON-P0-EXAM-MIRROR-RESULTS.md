# Farmakon P0.6 — Actual exam handlers + atomic mirroring
29 October 2026. PR #19, based on 7a4b02c. **PASS: 19 checks on PostgreSQL 17.11. SSI/F00 FAILED/OPEN.**

Implementation tested: [e9dec26fe00619da6cad47390408392019d3d11d](https://github.com/PhQMR7S/Farmakon/commit/e9dec26fe00619da6cad47390408392019d3d11d).
[Actions 40846974880 SUCCESS](https://github.com/PhQMR7S/Farmakon/actions/runs/40846974880), job 123356745009.
[Machine evidence](evidence/P0.6-EXAM-MIRROR.json), [test](../tests/exam-mirror-p06.mjs).

## Execution
The original platform POST/GET and server exam functions are transpiled from repository source. The existing testDatabase helper loads the production database adapter with only loopback test URL/TLS injection. Its lazily opened connections use a separate p05_writer LOGIN without superuser/BYPASSRLS. No application-side dual-write adapter, shadow read interception, or query serialization workaround is used.

P0.5 trigger function bodies and grants are reused from its SQL fixture. Installation changes only schema qualification to the disposable farmakon fixture and source ownership; records/activity already exist in the helper fixture. Exact replacement assertions fail if fixture contracts change. Other legacy tables receive fixture backend policies. No P0.5 security test was repeated.

Auth identity and rate-limit transport are synthetic. This tests original handler execution directly with Request/Response and real PostgreSQL, not a deployed HTTP server or real Supabase provider authorization.

## Observed PASS
- Concurrent original startExam returns one attempt; answer key is withheld.
- Concurrent save patches both survive and resume unchanged.
- Concurrent submit returns the same grade, rejects later saves, and creates one result event.
- Save/submit race preserves accepted answers and finalized state.
- Cross-student access is denied; expired/revoked enrollment is enforced.
- v2 deadlines reject late answers; legacy grace is preserved.
- Shadow CHECK failures during start/save leave all compared tables unchanged.
- Event-shadow failure during submit rolls back attempt/grade/event; recovery commits once and done result remains byte-for-byte stable.
- GET settlement failure rolls back; successful GET uses saved answers and yields one result event across repeated GET.
- Bidirectional EXCEPT comparisons verify all columns for attempts/events, including missing or extra rows. Snapshots for rollback include records, both shadows, activity and members.
- No duplicate active student/exam attempts or user/kind/target exam events after scenarios.
- Schema and fixture roles removed; successful container/network removal observed in job logs.

No runtime defect requiring an application change was exposed by these cases. The known P0.3 pg warning about parallel client.query from original GET remains visible with pg 8; it is not suppressed or claimed fixed. Runtime, dependencies and F00.6 are unchanged. Expected injected failures emit only the existing fixed platform failure marker.

## CI and remaining blocker
[Quality 40846983589](https://github.com/PhQMR7S/Farmakon/actions/runs/40846983589): scope PASS, existing SSI gate FAIL, unchanged baseline/postgres/browser SKIPPED. Explicit isolated-file allowlist extended only for this test/workflow/evidence/result document.

No blocker remains for P0.6's bounded handler integration. This does not prove load reliability, unknown network COMMIT outcome, deletion/export races, live provider integration, or migration readiness. SSI/F00 remain open. No new load, Production/Staging change, real student data, migration/cutover, merge/deploy, paid service or Drive operation.
Evidence-only follow-up does not constitute a second runtime run.
