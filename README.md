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
