# Farmakon V2 — P0 Critical Fixes and Production Readiness

Date: 2026-10-28. Draft [PR #19](https://github.com/PhQMR7S/Farmakon/pull/19), based on `audit/f00-regression-2026-10-26` at `3ecdc68d8ce3a483b75e27fbf039979a8f287363`. Depends on [PR #18](https://github.com/PhQMR7S/Farmakon/pull/18) and [PR #17](https://github.com/PhQMR7S/Farmakon/pull/17); tracks [Issue #1](https://github.com/PhQMR7S/Farmakon/issues/1). Production reference `7258c50062f4bb08cdf9686a727953313ad30260`. The branch disables automatic Vercel deployments. No production/staging data or settings changed.

## Verdict

**FAILED — release/load gate.** Isolated load stopped at 10 VU on an actual `startExam` HTTP 503 / PostgreSQL 40001 after five attempts. The 25-VU level was not run. SSI reliability risk remains OPEN; the connection-pool fix does not claim to resolve SSI. Production readiness is not established.

## Old main audit compared with F00

- **VERIFIED on development branch:** F00 already prevents done-to-active resurrection, preserves immutable graded results, merges acknowledged answer patches, settles exams atomically, enforces ownership and live course entitlement, and retains legacy timing behavior. Synthetic PostgreSQL and route tests were rerun below; real Supabase integration remains a separate gate.
- **FIXED here:** activation code could be consumed without adding the full purchased duration to an active enrollment.
- **FIXED here:** a client whose rollback failed could be returned to the connection pool.
- **FIXED here:** vulnerable Next.js and Zod versions identified by npm audit, subject to ongoing advisory changes.
- **PARTIAL:** expired/revoked course access is rechecked on attempt reads, saves and submissions. Actual provider sessions and all production configurations were not verified.
- **FAILED / OPEN:** serialization conflicts, including page-level SIReadLock conflicts across different students, can exhaust the existing retry budget.
- **BLOCKED / insufficient evidence:** live Auth mail, recovery, natural JWT expiry, provider Storage/RLS, full Auth/Storage disaster recovery, broader device accessibility, and production capacity.

## Changes

1. `lib/database.ts`, `tests/database-rollback.mjs`, `tests/helpers/pg-trace.mjs`: discard a connection after rollback failure or SQLSTATE connection-class failure. Preserve original error, five-attempt limit, SERIALIZABLE, backoff after release, and no retries for uncertain commits. Driver-fault tests demonstrate rollback and release behavior; this is not an SSI fix.
2. `app/lib/server.ts`, `app/api/platform/route.ts`, `tests/subscriptions.mjs`: unify manual and code renewal using max(current expiry, transaction time) plus purchased days. Code claim and extension remain inside one SERIALIZABLE transaction; failed claims throw to roll back. Code redemption refuses the existing explicit revoke sentinel (expiry zero); owner manual enrollment can restore it. No lifetime-code schema or pricing change.
3. `package.json`, `package-lock.json`, `app/api/platform/route.ts`, `tests/validation-contract.mjs`: Next 16.3.4 → 16.4.1 and Zod 3.25.76 → 4.6.6. Zod 4 string-keyed record APIs updated for exam answers. Existing React, Supabase and pg versions retained. npm advisory GHSA-673q-mjm6-r5xr first patched Next 16.4.1; GHSA-mrhx-c7xc-m3w5 first patched Zod 4.6.6. Validation contracts and existing routes were tested. Audit reported zero advisories at test time, not a permanent guarantee.
4. `vercel.json`: automatic deployment disabled for this branch. `.github/workflows/quality.yml`: tests target audit-base PRs and add regression suites. For this branch it explicitly fails the already-failed load gate instead of re-running unchanged load; no threshold was lowered.

## Results and limitations

| Check | Result |
| --- | --- |
| npm ci, TypeScript, Next 16.4.1 production build | **VERIFIED** locally |
| npm audit | **VERIFIED** zero reported vulnerabilities at check time |
| Backend, Auth/Callback, request limits, database, privacy/export, PWA, validation and SQLite subscription regression | **VERIFIED** synthetic fixtures. Privacy smoke initially hit sandbox spawn EPERM and passed with required local process permissions. |
| PostgreSQL 17: route smoke, exam concurrency/integrity, subscription, privacy/deletion, Storage RLS | **VERIFIED** isolated loopback database, synthetic identities. Auth and Storage provider transport are fixtures, not live Supabase. |
| Browser E2E | **PARTIAL** full run 43/44; Android exam case timed out during an overlapping build. Focused rerun on a stable build passed 1/1. This is not a fresh full 44/44 pass. |
| Real provider Auth/Storage/mail and DR | **BLOCKED**. No blocked Supabase images were retried. |
| SSI / bounded load | **FAILED** at 10 VU; stopped safely before 25 VU. No retry-limit/isolation/acceptance relaxation. |

The PostgreSQL subscription tests include 100 days remaining + 30 days = 130 days, expired subscriptions/codes, multiple courses, a coordinated competing claim, repeated requests, revoke and explicit owner restoration, and injected failure after claim with complete rollback. Same-code replay after a successful claim returns 400 without adding days. That prevents duplicate extension but does not return an idempotent success after a lost response. A repeated manual owner enrollment adds days again. Lost payment-approval response cannot recover the one-time plaintext code; these remain **PARTIAL**.

## Load evidence

Synthetic PostgreSQL 17, application SQL adapter and route handlers; Auth, rate-limit and Storage transport fixtures. Not a Vercel/Supabase capacity test.

| VU | requests | HTTP statuses | P50 / P95 ms | retries |
| --- | ---: | --- | --- | ---: |
| 1 | 12 | 12 × 200 | 10.40 / 107.10 | 0 |
| 5 | 60 | 60 × 200 | 18.29 / 126.50 | 13 |
| 10 | 110 | 109 × 200, 1 × 503 | 44.77 / 925.22 | 30 |
| 25 | not run | safety stop | — | — |

The failing operation was `startExam`, SQLSTATE 40001, five attempts. Node peak RSS 263.44 MiB, pool peak 3, waiting peak 7. A student receiving 503 should retry; no unconfirmed answer or altered deadline is implied. This single run is not a capacity guarantee. Prior F00.10.3 proved page-level SSI conflicts and noted that indexes, ANALYZE, and direct UPDATE did not establish a safe repair. A narrower typed physical layout/read-set experiment is a candidate, not an approved migration or a proven solution.

## Commits and CI

- [abedb83](https://github.com/PhQMR7S/Farmakon/commit/abedb83): disable automatic branch deployment.
- [76779a4](https://github.com/PhQMR7S/Farmakon/commit/76779a4): discard unsafe pool clients.
- [b7686ed](https://github.com/PhQMR7S/Farmakon/commit/b7686ed): atomic subscription renewal.
- [ef0ea07](https://github.com/PhQMR7S/Farmakon/commit/ef0ea07): dependency and validation changes.
- [2c73505](https://github.com/PhQMR7S/Farmakon/commit/2c73505): regression workflow and explicit failing load gate.

[Actions run 40756628602](https://github.com/PhQMR7S/Farmakon/actions/runs/40756628602) was in progress for code commit 2c73505 when this report was written; consult the run for its final result. No successful new Actions run is claimed in this report. The known failed load gate is intentionally red, not skipped as a success. The documentation-only final commit uses [skip ci] and does not certify the final commit independently.

## Rollback and next release gates

Revert individual commits on a review branch. No migration or backfill was introduced. Reverting the subscription fix restores the old lost-duration bug; do not reverse existing enrollments/codes or recalculate old results. Preserve F00.6 exam timing and snapshots, identity/entitlement guards, RLS and provider settings. Revert the dependency pair together with Zod record adaptations, and recheck advisories.

Before production release: resolve and independently verify SSI without weakening isolation or acceptance; reproduce zero unexpected errors using the existing bounded progression on a dedicated environment; validate real provider Auth/Storage and mail, deletion/export, restore and operational controls; complete full browser/device QA; review manual-payment replay/reissue behavior, migration/index rollout, deployment isolation, and cost. No claim is made for 1,000 concurrent users. No merge or deployment is authorized by this report.

