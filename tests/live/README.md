# Isolated Staging Auth gate

This suite makes **real provider and protected Preview requests**. It is opt-in and never runs in normal CI. Ordinary CI runs syntax and fixture regression tests only.

Prerequisites:

- Pinned Supabase Staging project and a reviewed Preview origin in `staging-target.json`.
- Three distinct disposable Auth users (owner/A/B) with provider-admin `app_metadata.farmakon_test_fixture=true`, names beginning `f00-e2e-`, and confirmed identities. Administrative confirmation does not prove mailbox delivery.
- Staging-only owner/Storage configuration, strict sessions and quota enabled, isolated DB connection, Deployment Protection retained.
- Supply credentials through a secure secret store: `FARMAKON_LIVE_SUPABASE_URL`, `FARMAKON_LIVE_PUBLISHABLE_KEY`, `FARMAKON_LIVE_PREVIEW_URL`, `FARMAKON_LIVE_ACCOUNTS_JSON` (owner/a/b email+password), and `FARMAKON_LIVE_DISPOSABLE=confirmed-staging-fixtures-only`.
- Protected access can use `FARMAKON_LIVE_VERCEL_OIDC`, or a short-lived alias-scoped `FARMAKON_LIVE_VERCEL_SHARE`. The latter bootstraps the official `_vercel_share` cookie with same-origin redirects only. It does not disable Deployment Protection. Revoke temporary sharing after the run.

Run `node tests/live/staging-auth.mjs`. Never log the credentials, tokens, cookies or full errors. Failures report fixed stage names and numeric HTTP status only.

The suite creates explicitly synthetic course/lesson/question/exam/Storage fixtures, tests populated A/B note/export isolation and revocation, and archives its synthetic course. It changes only fixture A's password temporarily and restores it; tests local/global logout and replay. Existing production users and original Staging accounts must never be used as fixtures.

For a provider-session-expiry probe, create a private `/tmp/farmakon-expiry-*` directory and set `FARMAKON_LIVE_EXPIRY_DIR`. The suite emits `ready.json` containing only the synthetic B user ID and waits up to 120 seconds. An authorized Staging-only coordinator must first verify the provider-admin marker and exact synthetic email, then set **only that fixture's** `auth.sessions.not_after` into the past and write `expired` into the directory. The suite verifies live 401 responses. This is not a forged JWT or a test of natural JWT expiration.

Signup, actual mailbox delivery, recovery links/callbacks and natural JWT expiration are separate gates. Do not infer them from admin-created fixtures, mock CI or a generic forgot-password response. Inspect the final Arabic report for actual results and limitations.
