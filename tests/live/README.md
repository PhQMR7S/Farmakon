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

## F00.4 synthetic deletion

`deletion-edge.ts` is a closed-by-default, Staging-only integration harness, not a
public account-deletion endpoint. `node tests/live/build-deletion-edge.mjs
/absolute/new/temporary/directory` packages copies of the actual coordinator,
store, provider and gate with a Deno SQL adapter. The generated `sql.ts` is taken
from `lib/database.ts`; environment access is injected as a plain object because
Edge runtime process environment mutation is unsupported. Pinned SDK imports are
included in `deno.json`. No credentials are read by the builder.

Deployment requires explicit authorized tooling to substitute an unpredictable
nonce and near-term expiry in memory, the reviewed Staging-only SQL script, the
existing Storage owner setting, native Edge runtime credentials, JWT verification
kept enabled, and exact synthetic names reviewed for each run. Never reuse names
with deletion tombstones or make this an unattended CI task. It uses real
admin-confirmed test users (not mailbox verification), real Storage and the real
private database. It verifies session denial, shared-file interruption, resumable
worker completion, deleted-user login/update refusal and second-user independence.
The script creates no paid resources and accepts no arbitrary SQL, user ID or
project URL from a request. Do not log response bodies from provider errors.

After running, replace the deployed function with an unconditional HTTP 410 handler
**and include a closed deno.json explicitly** so an old import_map path is not
inherited. Verify the HTTP response and the source. Independently count remaining
synthetic users/sessions/objects/records/leases; keep tombstones and record any
manual fixture teardown separately from successful worker execution. See the
F00.4 report for results, missing live Next API coverage, cache limitations and the
still-partial Auth/Storage disaster recovery gate.

## F00.5 protected Preview validation

`build-preview-deletion-edge.mjs /absolute/new/temporary/directory` packages the
manual F00.5 coordinator. It remains closed with an expiry of zero and sentinel
nonce/run label. Authorized deployment tooling substitutes a fresh reviewed run
label, short-lived nonce and expiry only in memory; JWT verification stays on.
The coordinator accepts only setup/state/run/resolve/cleanup, targets four fixed
synthetic identities, and checks provider-admin `farmakon_f005_fixture` before
cleanup (including the intentionally unmarked-for-deletion ordinary student).
It does not receive arbitrary user IDs, SQL, project URLs or object paths.

`preview-security.mjs /tmp/farmakon-f005-.../control.json` runs real desktop and
Pixel 7 viewport Chromium against a reviewed protected deployment. No network
transport is mocked. A short-lived deployment-scoped `_vercel_share` grant is
bootstrapped with same-origin redirect checks; TLS validation stays enabled.
Generated test credentials live only in a 0600 fixtures file in that private 0700
directory. The control file contains the reviewed Preview URL/deployment/commit,
Staging public key, temporary grant/nonce and coordinator endpoint; never commit
it, browser state, request traces, full provider errors or signed URLs.

The coordinator's storage/DB/Auth failures are explicit boundary injections in
packaged adapter copies, not provider outages or production code switches. Its
successful operations use real Auth/Storage/PostgreSQL and the application worker
logic. The browser also injects a Cache API deletion exception to verify the real
accepted UI's manual-cleanup instructions; the deletion HTTP transport remains real.

`preview-signed-url.mjs` separately proves that a signed grant can outlive local
session revocation until its own expiry. It restores B's login and checks the file
again, without changing B's data. This is not natural JWT-expiry testing.

After validation: run the coordinator's exact-fixture cleanup; audit synthetic
rows/users/sessions/objects independently; replace the coordinator with HTTP 410
and an explicit empty deno.json; restore the branch owner and turn the synthetic
flag off; deploy the reviewed head as a protected nonproduction Preview; revoke
all temporary sharing grants and erase local credential/browser-trust artifacts.
The report records test deployment and final review deployment separately.
