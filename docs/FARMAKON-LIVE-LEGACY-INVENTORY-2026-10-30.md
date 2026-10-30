# Farmakon — actual read-only legacy inventory
30 October 2026. PR #19, baseline ccf097a.
**Staging preflight PASS (limited scope); Production activation/F00 BLOCKED.**
[Aggregate evidence](evidence/LIVE-LEGACY-INVENTORY-2026-10-30.json).

| Observed check | Production: Farmakon | Farmakon-Staging |
|---|---|---|
| Project health | ACTIVE_HEALTHY | ACTIVE_HEALTHY |
| Exam attempts / result events | 0 / 0 | 3 / 1 |
| Source tables | Six, all RLS enabled | Eight, all RLS enabled |
| deletion_jobs | Absent | Present |
| Specialized exam store control | Absent | Absent |
| farmakon_app owns source tables | No | No |
| Inspected backend role elevated attributes | superuser/BYPASSRLS/CREATEROLE/CREATEDB false | Same |
| Preflight blockers | missing_deletion_ledger=1 | All checked counts zero |

These are actual snapshot counts, not synthetic data. Zero Production exam rows does not imply no students, courses or payments, and does not waive future deletion/restore protection. Those other counts were not read.

P0.9 preflight ran on Staging with app_role=farmakon_app. Production's query was adapted only because deletion_jobs is absent: its dependent check is NULL/not assessed and the missing ledger explicitly blocks approval. No ledger was created or silently substituted.

Queries used explicit READ ONLY transactions and final ROLLBACK, with 10s metadata limits and 15s statement/2s lock limits for preflight. Output is aggregate-only: no IDs, emails, answers, grade payloads, credentials or Auth rows were returned/saved. Initial metadata used multiple SELECT statements; the connector returned only the last result set, so one combined JSON SELECT supplied the complete inventory. No load or regression tests were repeated.

Production security advisor still reports [Leaked Password Protection Disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No setting or plan was changed, and current plan/feature eligibility was not assessed.

## Remaining blockers
- Production needs a reviewed durable deletion lifecycle/restore contract; the existing synthetic-only deletion flow must not silently become production retention policy.
- Specialized schema installation, real role/grant mapping and operational migration/rollback remain unapproved/unexecuted.
- Provider Auth/Storage/DR and the password-protection advisor finding remain unresolved.
- Staging PASS covers only P0.9 checks, not full privilege auditing or cutover readiness.

No DDL/DML, grants, flags, migrations/cutover, merge/deploy, paid service or Drive operation occurred. Flag values and deployed runtime revision were not read from secrets. Existing P0.8 isolated evidence stands; F00 remains OPEN.
