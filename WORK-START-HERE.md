# START HERE — Farmakon V2 Work handoff
Date: 2026-10-25 | STATUS: planned only; release NOT approved.

User request: build 10 approved modules in phases with verification before publishing. This repo is an existing platform, not a greenfield mockup. DO NOT delete real content, rewrite auth, switch hosting providers, commit secrets or trigger paid services.

1. Read docs/FARMAKON-V2-MASTERPLAN.md (scope/epics and acceptance).
2. Read docs/FARMAKON-V2-ENGINEERING.md (current code, dependencies, data/API/security architecture).
3. Read docs/FARMAKON-V2-QA-RELEASE.md (CI, security, test gates and copy-ready Work continuation instructions).
4. Follow issue #1 (F00) first, then issues #2/#3, #4/#5/#6/#7, #8, #9, #10 and #11.
5. Inspect GitHub main and live linked Vercel/Supabase before changes. The verified read-only baseline was: project farmakon Vercel production READY at 7258c50062f4bb08cdf9686a727953313ad30260; Supabase Farmakon ACTIVE_HEALTHY, private schema has 6 RLS-enabled tables. Current security advisor noted leaked-password protection disabled; verify and address.
6. Review existing Next 16/React 19/Supabase/pg code in app/platform.tsx, app/api/platform/route.ts and lib/database.ts. Historical Sites/D1/R2 references in docs/BUILD-STATUS.md are stale.
7. Run CI: npm ci; npm run typecheck; node tests/backend-smoke.mjs; node tests/pwa-smoke.cjs; npm run build. Expand with Postgres auth/entitlement integration and Playwright mobile/RTL E2E before merge.
8. Create separate implementation feature branches/PRs after F00; no PR merges, production deployment, database migration or paid provider enablement without risk review and explicit release approval. Document results with links and logs.
9. If Work is unavailable, the user must open Work mode themselves later and use the task brief in docs/FARMAKON-V2-QA-RELEASE.md. Nothing here schedules future autonomous execution.

Issues:
- #1 Foundation https://github.com/PhQMR7S/Farmakon/issues/1
- #2 Smart lecture https://github.com/PhQMR7S/Farmakon/issues/2
- #3 Search/library https://github.com/PhQMR7S/Farmakon/issues/3
- #4 QBank https://github.com/PhQMR7S/Farmakon/issues/4
- #5 Flashcards https://github.com/PhQMR7S/Farmakon/issues/5
- #6 Analytics https://github.com/PhQMR7S/Farmakon/issues/6
- #7 Planner https://github.com/PhQMR7S/Farmakon/issues/7
- #8 AI tutor https://github.com/PhQMR7S/Farmakon/issues/8
- #9 Instructor/reviews https://github.com/PhQMR7S/Farmakon/issues/9
- #10 Clinical hub https://github.com/PhQMR7S/Farmakon/issues/10
- #11 Interactive lab https://github.com/PhQMR7S/Farmakon/issues/11

Non-goals of this planning branch: implementing modules, running database migrations, marketing release, generating medical content, enabling billing, or scheduling Work.
