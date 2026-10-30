# Farmakon P0.10 — completed isolated operational package
30 October 2026. PR #19; baseline 04eaa806.
**PASS: 20 checks on PostgreSQL 17.11. Package preparation/testing complete. Service rollout and F00 remain blocked pending their separate gates.**

[Implementation checkpoint 9f84f1a](https://github.com/PhQMR7S/Farmakon/commit/9f84f1a2d45059c132fb061adf8c4306fd8421be) · [Actions 41111518596 SUCCESS](https://github.com/PhQMR7S/Farmakon/actions/runs/41111518596) · [Evidence](evidence/P0.10-OPERATIONAL-PACKAGE.json) · [Operational guide](../scripts/exam-store/package/README.md).

## Delivered executable package
- install.sql / schema.sql: atomic inactive installation, with RLS/role grants, 32 attempt and 32 result partitions, reviewed fixed-purpose barriers and no alteration of legacy rows.
- activate.sql: explicit operator and maintenance attestations; visible writer drain check; legacy blocker check; locked atomic exact copy, equality verification and readiness change.
- rollback.sql: locked, nonempty tested reverse copy including new answers/events; refusal on tombstones/conflicting state; transaction rollback on injected failure.
- uninstall.sql: only inactive/empty state; package objects removed while source records/activity and deletion ledger are retained.
- legacy-select.sql: P0.9's aggregate-only validation included within activation's locked SERIALIZABLE transaction.

No automatic migrations, new retention policy, missing-ledger creation, retries increase, isolation reduction, deployment or application runtime change was introduced in this phase. The invocation variables are operator acknowledgements, not authorization security boundaries. Administrators can bypass scripts; actual service changes require independent approval.

## Actual tests
Twenty PASS checks cover:
1. Missing explicit approval refuses before objects are created.
2. Missing deletion ledger refuses without partial installation.
3. BYPASSRLS backend refuses atomically.
4. Backend CREATE on the private schema refuses.
5. Atomic inactive installation creates all 64 child partitions.
6. Reinstallation refuses instead of overwriting.
7. Separate backend LOGIN cannot change control, disable triggers, set replica mode or directly read a partition; browser roles lack grants.
8. Specialized backend writes are rejected while inactive.
9. Activation without maintenance attestation leaves exact state unchanged.
10. A real separate backend transaction held open is detected and activation refused.
11. Duplicate active legacy attempts are preserved and block activation.
12. Injected target-copy constraint failure restores source, targets and control state.
13. Successful activation preserves exact JSON/IDs/timestamps/awarded results, catalogue and progress.
14. Unmodified legacy attempt/event writes are rejected after activation.
15. Uninstall refuses active data.
16. Rollback refuses to resurrect identities present in deletion_jobs.
17. Injected reverse-copy failure retains readiness=true and every specialized row/event.
18. Successful rollback preserves newly saved answers/events and the original done grade.
19. Safe uninstall retains original data and ledger.
20. Fixture roles/schema and service container/network are cleaned up.

Security barriers use fixed pg_catalog search_path and qualified tables, with PUBLIC EXECUTE revoked. Legacy/deletion barrier reads run as the reviewed installer so the guard cannot be hidden by a caller's RLS or missing control-table grants. No SQL parameter is turned into dynamic code. Backend DML is through parent relations only; no direct child grant is provided. Application/student authorization remains the server's responsibility, as verified separately in P0.8; this package is not a replacement for provider JWT/RLS/Storage integration.

## Actual Staging candidate review
A bounded READ ONLY query against Farmakon-Staging confirmed:
deletion ledger present; specialized store absent; farmakon_app present; elevated role flags false; source ownership false; schema CREATE false; source TRUNCATE false; membership in privileged roles false. No setting or data changed. This narrows the installation-role blocker but does not certify all workers, backups, deletion policy or a service cutover.

## CI disclosure
The initial package attempt failed on SQL pattern quoting before successful installation. That was corrected; a subsequent run on 2d91b69 passed 18 checks, and the final hardened source above passed all 20. These are targeted verification runs after code/guard changes, not reruns of prior P0.5/P0.6/P0.8 load suites.

[Quality 41111524851](https://github.com/PhQMR7S/Farmakon/actions/runs/41111524851) keeps the existing SSI gate failed; unchanged heavy suites are scoped out for the final tooling-only delta. An earlier scope omission for live-inventory documents unintentionally started unchanged regression jobs; baseline passed, browser was superseded/cancelled, and the old gate remained failed. These are not new full-validation claims. No app/dependency/migration file exemption was introduced.

## Stage completion and explicit boundary
The requested preparation/testing stage is complete with code, tested failure paths, evidence and a concrete runbook. The feature flag remains off; no package SQL was run against a service.

A separately approved next operation could install only the inactive package on Farmakon-Staging with the reviewed backend role, without activating/copying/deleting exam rows or changing the flag. That is a real schema/trigger/grant change, so it is not performed under the earlier no-Staging-change restriction.

Production remains blocked by its absent deletion ledger, pending lifecycle/retention and restore approval, real installation/operational rollout review, Auth/Storage/DR and the leaked-password-protection advisor finding. There is no honest basis to declare all F00 closed or to approve Production release from these isolated tests alone.
