# F00 / issue #1 — Phase 0 report

Date: 2026-10-26. **Status: in progress; gate not passed.** Implementation branch `feat/farmakon-v2-p0`. No main merge, production deployment, paid service, production migration or student-data write authorized/performed.

## Planning review
Reviewed draft PR #12, WORK-START-HERE.md, master plan, engineering and QA/release documents, plus issues #1–#11. Planning branch was based on main `7258c50062f4bb08cdf9686a727953313ad30260`; P0 includes the planning documents without merging PR #12.

Dependency order: #1 → #2/#3 → #4 → #5/#6 → #7 → #8 → #9 → #10 → #11. No later epic is marked implemented or complete by this PR.

## Verified read-only infrastructure
- Production Vercel `farmakon`: READY at main `7258c50`, deployment `dpl_BNWbrbCXEvRK9BxEqJd4Tkmorctg`; latest planning preview separately READY. Vercel project uses Node 24; preview deployment URLs have SSO protection.
- Supabase `Farmakon`, project `zviqtacbsprewyxrmpbb`: ACTIVE_HEALTHY, Postgres 17. Six private tables have RLS; backend role gets CRUD policies, browser roles no direct grants. No table triggers observed. Inspected column/index/grant/policy definitions, not student rows.
- Storage bucket private, allowed PDF/MP4/WebM/MP3/PNG/JPEG, provider object cap 50 MiB. API cap remains 4 MiB. SELECT checks entitlement/publication; INSERT owner-only. Private-schema SECURITY DEFINER helper has empty search_path, auth.uid() guard and restricted execute ACL.
- Security advisor: leaked-password protection disabled. Official docs say Pro+; left unresolved without enabling paid services. Performance advisor: unused records_course index; retained because removing it without representative load evidence is unwarranted.
- Vercel env **names only**: DATABASE_URL, DATABASE_CA_CERT, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, FARMAKON_OWNER_EMAIL. All are configured for both preview and production; **isolation not established**. Values were not decrypted; encrypted metadata does not prove endpoints are the same or different. Vercel flags DATABASE_URL as readable-secret; review its sensitive-variable configuration without exposing or rotating credentials in this PR.

## Implemented fixes and test infrastructure
- Recheck current exam/course entitlement for attempt listing, answer autosave and result submission/retrieval. Revocation/unpublication hides saved question snapshots; no attempts or progress deleted.
- Require explicitly published content for student access. New attempt construction rejects mismatched-course/non-question records and inaccessible questions.
- Regression test demonstrably failed before the fix (revoked student still received one active attempt), then passed after it. Added two-user private note/attempt and revoked/unpublished course cases.
- Auth contract tests execute real identity/owner logic with stub transport: verified email, editable metadata cannot grant owner, malformed signup, CSRF, unauthenticated reset, generic recovery and no-store logout.
- Existing API suite supports SQLite and real production PostgreSQL adapter in a dedicated empty loopback database named farmakon_v2_test. It refuses remote databases, connection options, existing farmakon schema and never reads DATABASE_URL. Fixtures contain no real users/content. Auth identity and media byte transport remain stubbed: this is not live Supabase Auth/Storage/RLS proof.
- Desktop/mobile Playwright tests cover Arabic RTL signup/recovery UI, validation, reset mismatch and cross-origin API rejection. Auth response fixture is explicit; no test credentials or bypass were added to runtime code.
- CI adds disposable Postgres 17 and browser jobs without production secrets. Node 24 matches Vercel. Concurrency is scoped per PR/ref so unrelated PRs no longer cancel each other.
- Reconciled current BUILD-STATUS and archived historical Sites notes.

## Commands and actual results
- npm ci: PASS (baseline).
- npm run typecheck: PASS.
- npm run test:backend: PASS against SQLite, including reproduced security regression.
- npm run test:auth: PASS (stubbed provider).
- npm run test:pwa: PASS.
- npm run build: PASS (production compilation only, no deployment).
- Playwright: PASS, 6/6 tests on desktop and Pixel 7 emulation (RTL), local production build at http://127.0.0.1:3100. Browser plugin unavailable; Playwright used. Bundled browser CDN failed, so a scratch-only Chromium 143 binary from @sparticuz/chromium was used with system fonts. Initial environment font setup and an exact-label test selector were corrected before the passing run; no runtime UI change was needed. No page exceptions; no horizontal overflow in the tested flow.
- PostgreSQL: pending GitHub Actions execution. Local environment cannot switch to a non-root user required by Postgres; no production database was substituted. Do not treat configured CI jobs as passed until observed.

## Remaining mandatory gate work
1. Establish isolated Supabase Auth/Storage/database and branch-specific preview variables; use two synthetic students and a test owner. Never run destructive fixtures against shared production config.
2. Real signup/confirmation/recovery/reset/logout, owner/student permissions, Storage token/RLS/revocation and media/range upload tests on protected preview. Current in-process tests do not prove these.
3. Distributed login/write rate limits, abuse policy, body limits without relying solely on Content-Length. Review provider Auth rate limits and redirect allowlist; no verified settings snapshot available yet.
4. Account export/deletion and retention workflow; session invalidation and cache clearing verification. No deletion endpoint implemented by this slice.
5. Backup/restore rehearsal on disposable data; document production backup availability and rollback procedure. No backup or restoration claim.
6. Concurrent exam start/save/submit and code redemption races, including SERIALIZABLE retries; SQLite sequential tests do not establish concurrency safety.
7. Real device/offline expiry/weak network/accessibility checks and representative load test. No 750-user capacity claim.
8. Resolve or explicitly accept leaked-password warning and readable-secret configuration risk within the no-spend constraint.

No approval is requested to ship this partial gate. Review the concrete draft changes; keep #1 open and later implementation blocked until required evidence is available.
