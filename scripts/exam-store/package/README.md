# Prepared exam operational package
Status: isolated test/review package. No service installation or activation is authorized by this document.
Runtime: P0.8, FARMAKON_EXAM_STORE_ENABLED disabled by default. Production flag use is explicitly blocked in application code.

## Files and exact effects
| File | Effect after separately approved invocation |
|---|---|
| install.sql | One bounded transaction creates exam_attempts/exam_results (32 partitions each), control row ready=false, indexes, RLS policies, mode/deletion triggers and helper functions; grants parent DML and control SELECT to the one reviewed backend role. No legacy data copied/deleted. |
| activate.sql | Under maintenance/drain and exclusive locks, validates legacy aggregate preflight, copies exact JSON/IDs/timestamps and events, verifies bidirectional equality, removes the copied legacy attempt/event rows, then sets ready=true in the same SERIALIZABLE transaction. |
| rollback.sql | Under maintenance/drain and exclusive locks, refuses tombstoned identities or conflicting legacy state; restores exact current specialized data/events to legacy, verifies equality, empties specialized tables, and leaves ready=false atomically. |
| uninstall.sql | Only after inactive/empty checks: removes package-owned tables/partitions, triggers/functions. Retains existing records, activity, deletion_jobs and unrelated schema objects. |
| schema.sql | Included only by install.sql inside its transaction. Do not execute it directly. |
| legacy-select.sql | Shared aggregate preflight, inside activate.sql's transaction and locks. It never repairs legacy rows. |

Scripts set ON_ERROR_STOP. A failed statement or gate closes the connection with its transaction uncommitted, so PostgreSQL rolls it back. A lost COMMIT acknowledgement is not the same as a known rollback: inspect authoritative state before retrying. There is no automatic retry or unconditional rerun of migration commands.

## Mandatory review before any real invocation
1. Identify the target by verified connection/project, not a guessed URL. Use the existing approved credential mechanism; do not commit or paste connection secrets into issue/PR/log output.
2. Separately approve the exact service change. The operator_authorized=APPROVED variable is an explicit operator acknowledgement, **not an authentication/approval enforcement mechanism**. An administrator can bypass scripts; these files are not a security boundary against database administrators.
3. Verify actual deletion_jobs lifecycle, latest deletion/revocation ledger, data retention decisions and working restore/backup. The package does not create a missing ledger, adopt the synthetic-v1 deletion policy for Production, alter Auth/Storage, or establish backup freshness.
4. Review all application/worker database roles and drain every writer. The selected app_role must not be a superuser, BYPASSRLS/CREATEROLE/CREATEDB role, source/installer-role member, schema creator or source TRUNCATE holder. The installer needs DDL rights and visibility into pg_stat_activity. Backend application permissions are trusted server permissions, not per-student JWT policies.
5. Inspect default privileges, service roles, direct partition grants, trigger owners and inherited memberships against the actual deployment. Browser anon/authenticated roles receive no package grants; direct backend child access is revoked. The new fixed-purpose SECURITY DEFINER barriers are owned by the reviewed installer, use pg_catalog search_path and qualified tables, and have PUBLIC EXECUTE revoked.
6. Take and verify the agreed backup/restore route. Review locks, downtime and rollback feasibility. An isolated PASS is not release approval.

## Operational order (not executed against a service here)
- Installation can only be considered once the existing deletion ledger and role review are accepted. It keeps ready=false and preserves the legacy path. It refuses partial/repeated installation rather than overwriting it. Locks time out after 2 seconds; statement execution is capped at 30 seconds. A timeout requires investigation, not increasing limits blindly.
- Before activation: deploy/review the intended compatible runtime under flag=false, put the application in maintenance, stop traffic and all scheduled/background/administrative writers, confirm transactions are drained. The SQL checks visible open source-capable client transactions, but cannot prove that a paused worker will not resume or a new external writer will not start. writers_drained=YES is an operator attestation, not a substitute for maintenance.
- Run activate.sql only with separately approved service cutover. Switch the runtime flag only after a confirmed successful commit/readiness check; keep traffic stopped across the flag transition. Run the required authenticated smoke/security checks before reopening. Do not enable this in Production while the application release guard or provider/F00 gates remain unresolved.
- On any activation SQL failure: leave flag=false, check source/control/target state and resolve the actual blocker. On an uncertain COMMIT: keep maintenance on and read authoritative readiness/data equality first; never assume failure or replay blindly.
- For rollback after specialized writes: maintenance/drain first, verified recovery/ledger available, use the compatible current runtime, run rollback.sql, confirm ready=false and exact restored data, then disable the flag. Reverting the binary or disabling the flag before copying current data back is unsafe; P0.8 deliberately rejects flag/control mismatch.
- Never force rollback past a tombstone, missing ledger, conflicting ID, pre-existing legacy exam data, failed copy/equality check, permission error or active writer. Do not delete rows to make the gate pass.
- Optional uninstall follows only successful inactive/empty validation and flag=false. It does not delete the ledger or original source data.

## Invocation form for an approved, reviewed target only
Use psql -X with ON_ERROR_STOP=1 and an existing securely selected database connection. Supply app_role=<reviewed role> and operator_authorized=APPROVED. Activation/rollback also require writers_drained=YES. Use -f scripts/exam-store/package/<operation>.sql so relative includes resolve to this pinned directory.
Pin/review the Git commit and all included SQL files before execution. There is no startup hook, web endpoint, automatic migration path or CI access to a real target.

## Scope and outstanding release gates
Tests execute these exact scripts in a fresh postgres:17 container using synthetic rows and a distinct limited backend LOGIN. They cover explicit refusal, permissions, duplicate legacy data, drain detection, atomic copy/rollback failure, nonempty rollback after new writes and safe uninstall.
They do not establish live provider Auth/Storage/DR, real data backup/restore or every historical format/role. The live Production inventory found deletion_jobs absent and leaked-password protection disabled; these are not repaired or waived by this package. F00 remains open until independent gates are satisfied.
