# Farmakon

Arabic pharmacy learning platform, Next.js 16 on Vercel, with independent Supabase email/password authentication, a private PostgreSQL schema and private Supabase Storage.

## Runtime configuration

Configure these through Vercel environment settings; never commit secrets:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
- DATABASE_URL: a restricted farmakon_app connection, preferably the project's verified transaction pooler endpoint for serverless execution.
- FARMAKON_OWNER_EMAIL: verified owner email; signup never grants ownership.

The backend role has access only to the farmakon schema. Browser roles have no direct access to platform tables. Storage reads are authorized against course publication and current entitlement.

## Auth setup

Configure the production Site URL and exact /auth/callback redirect URL in Supabase Auth. Email confirmation must remain enabled. Password reset uses /auth/callback?next=/reset-password. Configure an SMTP provider before opening unrestricted student registration; the default email sender has provider limitations.

## Verification

npm ci
npm run typecheck
npm run build
node tests/backend-smoke.mjs

GET /api/health checks database connectivity. GET /api/platform without a session must return 401. A clean build does not verify email delivery or end-to-end sign-in.

Existing Sites data has not been imported. Existing Sites remains available during migration. Uploads through Vercel are limited to 4MB pending direct resumable storage upload support; external video links remain supported. No paid service is enabled by this migration.

## V2 development gates

Start with [WORK-START-HERE.md](WORK-START-HERE.md) and [current Phase 0 report](docs/FARMAKON-V2-P0-REPORT.md). Current runtime status supersedes the archived Sites notes.

- `npm run test:backend` — SQLite route regression suite.
- `npm run test:auth` — identity/Auth contract with provider transport fixtures.
- `npm run test:pwa` — manifest and service-worker checks.
- `npm run test:postgres` — same route suite through the actual PostgreSQL adapter. Requires `FARMAKON_TEST_DATABASE_URL` pointing to an **empty loopback-only** database named `farmakon_v2_test`. Never set production credentials for this test. It creates and removes only its fixture schema; refuses an existing `farmakon` schema. CI provides disposable Postgres 17. Auth and Storage transport remain fixtures.
- `npm run build` then `npm run test:e2e` — Playwright desktop/mobile Arabic authentication UI checks; install its Chromium with `npx playwright install chromium`. Uses mocked signup responses and no live account writes. Real Supabase lifecycle testing remains a staging gate.

No test requires Vercel/Supabase production secrets. Do not enable a preview against production data for mutation tests. Main merge, production deployment, schema rollout and paid services require explicit approval.
