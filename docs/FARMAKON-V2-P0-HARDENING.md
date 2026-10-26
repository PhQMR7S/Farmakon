# P0 continuation — request bounds, concurrency, rate limiting and staging

2026-10-26. Phase #1 remains OPEN. This slice builds on draft PR #13; neither PR may be merged without explicit approval. No production schema, data, credentials or environment variables were modified.

## Implemented
- Stream actual request bytes with bounded allocation for platform JSON (250,000 bytes), Auth JSON (8 KiB) and uploads (4 MiB). Missing Content-Length cannot bypass the cap; false/invalid lengths and malformed JSON produce 400/413 before storage writes. Preserve Arabic responses and existing upload/media access behavior.
- All platform mutations now run inside a SERIALIZABLE transaction. AsyncLocalStorage keeps nested statements/batches on the same checked-out client. Serialization/deadlock failures retry the entire database-only action at most four times; unknown network/commit failures are not retried. No email/provider/storage calls occur inside these action transactions.
- PostgreSQL race tests cover simultaneous exam start, duplicate submit, save-versus-submit, single-use activation redemption, stable result responses and one result event. SQLite tests remain sequential regressions and are not claimed as race evidence.
- Add a private `farmakon.rate_limits` table and an atomic UPSERT limiter. Key material uses server-secret HMAC; no raw IP/email/password stored. Limits: Auth 30 requests/15 min per client (logout exempt); authenticated platform writes 120/min/user; owner uploads 20/min. Fixed-window boundaries can allow bursts and require production tuning; provider-side Auth limits remain necessary.
- Trust x-vercel-forwarded-for only when VERCEL=1, validate a single IP, otherwise share an unresolved-client bucket. [Vercel header documentation](https://vercel.com/docs/headers/request-headers). Never use a user-supplied forwarding chain to create arbitrary buckets.
- Limiter is disabled unless FARMAKON_RATE_LIMIT_ENABLED=true. When enabled, missing secret/database failure returns 503 rather than bypassing the limiter. Configure FARMAKON_RATE_LIMIT_SECRET (at least 32 random characters) only on the server. Purge rows expired more than 24h on subsequent requests; rows may remain while no traffic occurs. The migration must precede activation. Nothing enables it in production in this PR.
- Add a CI-only synthetic pg_dump/psql restore drill into a separate disposable database, comparing Arabic JSON/bigint data checksums. This is not proof that production backups exist or have been restored.

## Isolated Supabase preparation
- Quoted project cost was **$0/month** in the existing Farmakon Free organization. Created `Farmakon-Staging`, ref `qfzharpouemueipsrduv`, eu-central-1, ACTIVE_HEALTHY. No paid upgrade or add-on. This is the creation quote, not a guarantee of unlimited hosting.
- Applied an empty six-table legacy schema with private grants/RLS, plus the additive rate-limit migration **only to this staging project**. Bootstrap script is staging-only, not a production migration and must never run on a populated project.
- `farmakon_app` is deliberately NOLOGIN, without superuser/role creation/DB creation/RLS bypass. Browser roles have no table access. All seven tables have RLS, and backend CRUD grants are present. Staging security advisor returned no lints on inspection.
- No production records, users or media copied. A connector attempt to SET ROLE farmakon_app was denied; no grants were expanded to bypass it, and verification found zero retained probe rows. ACL inspection is not a substitute for an actual authenticated runtime test.
- Vercel overrides are restricted to preview branch `feat/farmakon-v2-p0-hardening`: Supabase URL/key point to staging, owner email is an invalid synthetic domain, DATABASE_URL/CA are deliberately blank, and limiter remains off. This prevents the branch inheriting production DB access. It intentionally cannot load platform data until a verified staging connection is configured. No production/default preview values were edited.

## Validation
Local: TypeScript, production compilation, SQLite/API regression, Auth contract, bounded-request tests and PWA checks passed during this slice. Desktop/mobile Playwright passed 6/6 with fixture Auth transport. Check the PR's exact code commit and CI for PostgreSQL concurrency, quotas and pg_dump restoration; do not infer pass from configured jobs.


### Observed CI and protected preview evidence
- All three GitHub Actions jobs passed on code commit `137531d54fcbcd7f3e4ce860c54ca681e9028745`: [run 40278800880](https://github.com/PhQMR7S/Farmakon/actions/runs/40278800880). PostgreSQL logs explicitly confirmed concurrent start/submit/save, single-use redemption, independent hashed quota keys, reset boundary and pg_dump restoration checksum.
- Vercel deployment `dpl_4qUMmDMkgsdNAWm8CHpRcWG9GFHN` is READY for that code. Connector HTTP check: `/login` returned 200 with Arabic login content; `/api/health` returned the expected 503 `{database:false}` because branch DATABASE_URL is intentionally blank. Build READY does not mean an operational learning platform.
- Runtime preview: https://farmakon-1xi095sfr-phqmr7s.vercel.app . Draft PR: https://github.com/PhQMR7S/Farmakon/pull/14 . No authenticated writes, signup email sends, real Storage checks or production mutations were performed on preview.
- Read-only metadata verification confirmed all six staging overrides target only `preview` + branch `feat/farmakon-v2-p0-hardening`.

## Remaining before F00 can pass
1. Obtain the verified staging transaction-pooler host/TLS connection configuration, provision a restricted login credential, and set branch-only DB variables. Do not guess pooler hostnames or turn off certificate verification.
2. Configure staging Auth callback/redirect allowlist and synthetic test identities, then test real signup/confirm/reset/logout and Storage entitlement/RLS on protected preview. A publishable key alone does not provide admin user management or email delivery access.
3. Account export/deletion/retention and session invalidation workflow remain unfinished. Do not claim a deletion request deletes an Auth account.
4. Review production backup availability and actual restore runbook separately from the synthetic CI drill.
5. Tune rate limits, test abuse/load/real-device offline behavior, resolve or accept production advisories, and review migrations/rollout. Production remains on its original main commit.

The Supabase connector available in this session does not expose Auth configuration, the verified pooler connection panel or admin-user lifecycle operations. Dashboard configuration is needed before the real staging gates can be completed. No browser fallback or credential retrieval was attempted in this slice.
