# Farmakon V2 — QA, Release Gates & Work Handoff
Prepared 2026-10-25. READ before any implementation. Work resumes only when the user starts Work mode; no scheduled/background handoff exists.

## Mandatory first actions for Work
1. Open repo PhQMR7S/Farmakon and docs/FARMAKON-V2-MASTERPLAN.md + docs/FARMAKON-V2-ENGINEERING.md.
2. Inspect main current SHA, linked Vercel farmakon project and Supabase Farmakon schema. Compare with docs, inspect open PRs and new GitHub issues. Do NOT assume old descriptions in docs/BUILD-STATUS.md represent current migrated infrastructure.
3. Inventory route actions, schema, indexes, RLS policies, session settings, storage bucket ACL, Vercel deploy config and environment NAMES (never reveal values).
4. Run baseline tests and record logs/status before changes: npm ci, npm run typecheck, node tests/backend-smoke.mjs, npm run build. No pass claim until actual execution.
5. Add live PostgreSQL integration tests in disposable staging database, then auth/role/media isolation cases and UI browser E2E. Build CI independent of production secret access.
6. Work in small reviewable feature branches / draft PRs; do not merge main or publish production without human approval for release and review of migration/expense impact.
7. Check user budget before selecting AI provider, video CDN, high-volume indexing, or any paid plan. Keep disabled-by-default flags and no patient data sharing.
8. Correct Supabase security advisor warning about leaked password protection after settings review and user-controlled configuration. Do not falsely claim settings were changed merely because a warning is documented.

## Feature test matrix
| Epic | Unit | API / integration | E2E + accessibility | Security / abuse |
| --- | --- | --- | --- | --- |
| F01 Smart lecture | seeking, bookmarks, sync merge | notes/transcript/progress per user | Android RTL, iOS/PWA, captions, external Drive fallback | revocation + signed assets; offline expiry |
| F02 AI tutor | citation sanitizer, retrieval ranking | server scope, quota, provider timeout | cited bilingual answer, no-source response | prompt injection, cross-course context leak, PII, spending |
| F03 QBank | scoring, timing, question versions | exam atomic submit/snapshot | custom test, resume, review explanations | answer-key secrecy, replay/IDOR |
| F04 Flashcards | scheduler time-dependent fixtures | review-event idempotency | flip/rate/offline reconciliation | user-deck isolation, entitlement |
| F05 Planner | task allocation/holiday/timezones | schedule edits, rescheduling | daily agenda, edit exam date | cross-user tampering, notification consent |
| F06 Analytics | percentages, timer logic | aggregate filtering | student weak areas + empty state | role isolation, raw event minimization |
| F07 Search/library | Arabic normalize, indexing diff | ACL-filtered index + unpublish | search suggestions, filters, deep links | snippet/asset leakage and cache |
| F08 Ratings/instructors | aggregate + eligibility | teacher scoped RBAC | review submit/moderation/report | spoofed verified reviews + role escalation |
| F09 Clinical hub | verified formula fixtures | monograph publishing/review | accessibility, formula source + date | invalid units, unsafe clinical assumptions |
| F10 Lab | deterministic scoring | case versioning/staff approval | branching case and replay | unsafe content, duplicate scores |

## Release checklist — all required
- [ ] No prod merge or paid service without explicit permission and budget review
- [ ] All expected source files tracked, no secrets/data/licenses in Git history or public assets
- [ ] npm ci and TypeScript succeed
- [ ] Existing backend-smoke, PWA smoke and new unit/PG integration pass
- [ ] Production build succeeds; no warnings that hide runtime failures
- [ ] All APIs validate auth, course entitlement, role scope and malformed inputs
- [ ] Supabase RLS/grants and security advisors inspected; no critical findings
- [ ] Admin/teacher/student account isolation tested with at least two independent test users
- [ ] Mobile RTL/English, accessibility keyboard/reader, PWA/offline and weak-network smoke pass
- [ ] Current 750-student goal load-tested on realistic staging data; no unsubstantiated throughput guarantee
- [ ] AI: provider legal/consent review, citations accuracy, quota/cost caps, prompt injection tests, no patient data
- [ ] Clinical: faculty validation signed off and formula source/date shown, education-only labels until approved
- [ ] DB backup taken & restore tested; additive migration reversible or rollback plan documented
- [ ] Vercel preview deploy and login/signup/confirm/reset/media, storage quotas and telemetry verified
- [ ] Stakeholder review of preview; explicitly approve production cutover
- [ ] After production: smoke, logs, auth, billing guard, privacy, rollback observability

## Baseline environment and limitations confirmed by tool inspection
- GitHub default main, repo PhQMR7S/Farmakon; Vercel project farmakon last inspected production deployment READY, commit 7258c50062f4bb08cdf9686a727953313ad30260.
- Supabase project Farmakon ACTIVE_HEALTHY. Tables observed in schema farmakon: records, settings, members, enrollments, codes, activity; RLS enabled on six. Security advisor warns about disabled leaked-password protection.
- Live browser login, provider email delivery, 750-user load, downloadable video, clinical sources and new features not exercised in this preparation pass.
- Old docs refer to Sites/Cloudflare D1/R2 and no GitHub repository; treat them as historical and reconcile before release.
- No API key, payment recipient, clinical reviewer, AI budget, medical content license or video streaming cost is supplied by this document. Do not invent them.

## How to continue in Work mode
Use the following exact starting brief:

> Continue the approved Farmakon V2 implementation from GitHub PhQMR7S/Farmakon. Review docs/FARMAKON-V2-MASTERPLAN.md, docs/FARMAKON-V2-ENGINEERING.md and docs/FARMAKON-V2-QA-RELEASE.md on branch planning/farmakon-v2-work-handoff-2026-10-25, plus the associated issue tracker and draft planning PR. Verify current main and linked Vercel/Supabase live setup. Start with Phase 0 security/integration tests and documentation reconciliation, then proceed in dependency order through F01/F07, F03/F04/F06/F05, F02, F08, F09 and F10. Implement incrementally in isolated PRs; run automated and preview tests before proposing any merge. Do not modify or publish production, enable paid services, alter student data or expose secrets without explicit approval. Give a brief changelog, blockers, cost implications and evidence of tests after each phase.

## Scope of this handoff
This is an approved implementation specification and operational handoff, NOT completion of feature code, QA, production rollout, database migration or automatic Work scheduling.
