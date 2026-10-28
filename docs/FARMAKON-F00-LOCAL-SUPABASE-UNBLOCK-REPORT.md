# Farmakon F00.10.1 — Local Supabase unblock report

Date: 2026-10-27 UTC. Repository: PhQMR7S/Farmakon. Audit branch: `audit/f00-regression-2026-10-26`.
Draft [PR #18](https://github.com/PhQMR7S/Farmakon/pull/18) depends on #17; Issue #1 remains open.

## Verdict

**BLOCKED. The environment is not ready for F00.11.** Public image metadata was verified and a bounded, technically changed pull was attempted. The first PostgreSQL image still returned a registry request-limit error. PostgreSQL, Auth, Storage, Mailpit and gateway did not start. No real local Auth/Storage integration result or successful recreation cycle is claimed.

References: [F00.9](FARMAKON-F00-DISASTER-RECOVERY-REPORT.md), [F00.10](FARMAKON-F00-LOCAL-SUPABASE-VALIDATION-REPORT.md). Existing application regressions were not rerun merely to generate green checks.

## Prior evidence reviewed

| Run | Established result |
|---|---|
| [40551247490](https://github.com/PhQMR7S/Farmakon/actions/runs/40551247490) | ECR download failure |
| [40552204396](https://github.com/PhQMR7S/Farmakon/actions/runs/40552204396) | Diagnostic ECR failure: Data limit exceeded |
| [40553163596](https://github.com/PhQMR7S/Farmakon/actions/runs/40553163596) | GHCR request-limit failure |
| [40551244915](https://github.com/PhQMR7S/Farmakon/actions/runs/40551244915) | PostgreSQL load failed: one final error at 25 VU; see reliability analysis below |
| [40553482784](https://github.com/PhQMR7S/Farmakon/actions/runs/40553482784) | Scope passed; baseline/postgres/browser skipped, not integration success |

## Registry diagnosis: proved and unknown

The bounded metadata-only [run 40555923254](https://github.com/PhQMR7S/Farmakon/actions/runs/40555923254), job 122371829013, completed. It used at most 32 HTTPS requests, normal TLS verification, anonymous public registry authentication kept in memory, manifest GETs and one first-layer HEAD per registry. It downloaded no image blobs and printed no authentication token.

GHCR DNS resolved, TLS requests succeeded, anonymous token exchange returned 200, and all six tag/platform manifests returned 200. Manifest body SHA-256 matched the advertised digest. The first PostgreSQL blob HEAD returned 200 with length 3,643,742 bytes. This establishes metadata access and blob HEAD access, **not** successful blob streaming.

ECR DNS/TLS and PostgreSQL tag/platform manifests succeeded and matched GHCR. Its first blob HEAD returned 401. The next repository stopped at the diagnostic's own 32-request boundary (`PROBE_BOUNDARY`). That boundary is not evidence of a new ECR provider quota. Overall metadata output is partial because ECR coverage stopped; all six GHCR images were inspected.

The subsequent real, sequential digest pull failed with `REQUEST_LIMIT`, reporting `allowed: 44000/minute`. This is the observed download blocker. DNS failure, invalid image tag and inability to obtain public GHCR metadata were not observed in that probe. The exact quota owner/scope, whether a shared egress intermediary or registry itself imposed it, actual request count, HTTP status and failing blob/layer are **not established** by the sanitized Docker error. Do not infer those details from the wording alone. No failing digest appeared in the error beyond the requested image digest.

Safe evidence: [registry metadata and pull/cleanup observations](evidence/F00.10.1-REGISTRY.json).

## Official images, versions and size

Supabase CLI **2.81.3** (release marked prerelease), Node **24**, linux/amd64. Official [CLI image template](https://github.com/supabase/cli/blob/v2.81.3/pkg/config/templates/Dockerfile) supplies upstream repositories/tags; the pinned CLI's official GHCR rewriting is used. No third-party mirror or unverified substitute was introduced.

| Upstream repository | Tag | Official selected repository | Compressed layer bytes |
|---|---|---|---:|
| supabase/postgres | 17.6.1.095 | ghcr.io/supabase/postgres | 362097222 |
| supabase/gotrue | v2.187.0 | ghcr.io/supabase/gotrue | 25293757 |
| supabase/storage-api | v1.41.8 | ghcr.io/supabase/storage-api | 213882819 |
| library/kong | 2.8.1 | ghcr.io/supabase/kong | 49335657 |
| postgrest/postgrest | v14.5 | ghcr.io/supabase/postgrest | 6287369 |
| axllent/mailpit | v1.22.3 | ghcr.io/supabase/mailpit | 12264135 |

Full verified tag and platform digests are pinned in [images.lock.json](../tests/local-supabase/images.lock.json); all layer digests/sizes are in the safe evidence. Unique compressed layers total **665,299,138 bytes** (~634.5 MiB). This excludes unpacked disk usage, metadata/config blobs, retransmissions and build dependencies; it is not measured network throughput. Largest PostgreSQL layer: 353,111,029 bytes. First layer: `sha256:bc1da058f299723f8258c5a82dd007d1dd72e275087b726d5e1be5ef6198f286`.

## Changed mitigation and execution

One deliberate changed-mechanism trial used digest-pinned sequential pulls with Docker daemon `max-concurrent-downloads=1` and `max-download-attempts=1`, no wrapper retry, 180-second bound per image. It reused only the ephemeral runner's ordinary content-addressed layer cache and would retag verified local digests for the CLI. Original daemon configuration was saved privately and restored in finally. See official [daemon options](https://docs.docker.com/reference/cli/dockerd/) and [digest/cache pull behavior](https://docs.docker.com/reference/cli/docker/image/pull/).

[Run 40556678468](https://github.com/PhQMR7S/Farmakon/actions/runs/40556678468), job 122374479994, checked out `11f563eb2ef782cc739c6445f7751448129f4345`. Fresh Ubuntu runner had 4 CPUs, 15,357,829,120 available memory bytes and 92,039,258,112 free disk bytes. It failed on the **first** pinned PostgreSQL image:
`ghcr.io/supabase/postgres@sha256:4c087262afbfbb47da86e2863a52d7e424eb21ab589f732d77eeaab51be8e521`.
No CLI service startup followed. Round two was canceled by fail-fast. The mitigation did not resolve the block; downloads stopped after this trial.

An unintended preceding [run 40556434600](https://github.com/PhQMR7S/Farmakon/actions/runs/40556434600) received the label event on older commit `ed6c292` during PR head propagation and repeated the previous startup path. It failed with the same rate-limit wording and cleaned up; it is not evidence for the changed mitigation. Added a live branch-head versus checked-out-HEAD assertion before downloads and cancel-in-progress concurrency; the corrected run's PR HEAD was verified before activation. Both manual labels were removed after diagnosis. No further pull attempts are authorized by this report.

## Auth, mail, JWT, Storage and schema

| Required proof | Result |
|---|---|
| PostgreSQL/Auth/Storage/Mailpit/API gateway running | BLOCKED: images unavailable; no service started |
| Signup, Mailpit confirmation, valid callback, invalid/replayed link | BLOCKED: suite not reached |
| Recovery email, password change and login | BLOCKED: suite not reached |
| Natural JWT expiry, refresh rotation, two devices and logout | BLOCKED: suite not reached |
| Private PDFs: upload/read/download/SHA-256, student isolation, owner, anonymous/revoked denial, metadata, signed URL expiry and deletion | BLOCKED: suite not reached |
| Actual Farmakon SQL policy application and migration compatibility | Reviewed allowlist retained; live application/behavior BLOCKED |
| Two clean independent successful creation cycles | BLOCKED: first cycle failed; second canceled |

The existing test suite remains a planned real-service test, not a fixture substitute for these results. A refresh assertion now checks token rotation and retained session ID, but has not executed against local Auth. Reviewed local SQL remains limited to bootstrap/quota/Storage entitlement ACL/session helper; no automatic migration glob, F00.7 index or Staging role change. Local Mailpit would not prove Staging SMTP, local config would not prove actual Staging settings, and neither would establish complete provider restoration.

## PostgreSQL load reliability finding

[Run 40551244915](https://github.com/PhQMR7S/Farmakon/actions/runs/40551244915), job 122355263035: at **25 VU**, **290 operations**, **one final error** (0.3448275862%). The operation was **startExam**, with **49 calls**, one failure (2.0408163265% within that operation), SQLSTATE **40001**. [Safe extracted summary](evidence/F00.10.1-RELIABILITY.json).

PostgreSQL logs report serialization failure due to read/write dependencies, including cancellation as a pivot during write/commit attempt. The adapter uses SERIALIZABLE and retries the entire transaction at most five attempts, releasing the connection before jittered backoff (caps 80/160/320/640 ms). The evidence is consistent with bounded retry exhaustion under contention. The exact competing transaction pair/predicate-lock cause is not proved.

Source maps 40001 to **HTTP 503**; this is a **code-derived mapping**, not a directly recorded HTTP response from that failed request. The old summary retained failure codes but not a per-request HTTP status histogram.

**Reliability Risk remains OPEN.** No retry cap, isolation level, zero-error threshold or application code was changed. No heavy load rerun was made without a more specific causal hypothesis. Previous green rounds do not guarantee reproducibility. This was isolated real PostgreSQL with synthetic data and test transport components, not live Production traffic or a Production capacity measurement. PostgreSQL requires retrying whole serialization-failed transactions; bounded retry policy can still surface failures ([official guidance](https://www.postgresql.org/docs/17/mvcc-serialization-failure-handling.html)).

## Changes, checks and CI interpretation

Added bounded registry probe/workflow, verified image lock and serial prefetch; tightened stale-event prevention and cleanup assertion; added refresh-rotation assertion and safe evidence. No runtime application, dependency, migration, subscription or retention-policy change.

| Commit | Purpose |
|---|---|
| [ed6c292](https://github.com/PhQMR7S/Farmakon/commit/ed6c292bae1a3252bbb2f383d62cf332ea98a48b) | Metadata diagnostic and reliability evidence |
| [5006b99](https://github.com/PhQMR7S/Farmakon/commit/5006b99c9436c4f9e00b87d215359541fb09b5be) | Digest lock, bounded serial pull, refresh assertion |
| [11f563e](https://github.com/PhQMR7S/Farmakon/commit/11f563eb2ef782cc739c6445f7751448129f4345) | Reject stale PR HEAD before download and cancel superseded opt-in run |

Local syntax checks cover changed JS modules, shell and YAML. These are static checks, not real-service passes. Quality [40555737252](https://github.com/PhQMR7S/Farmakon/actions/runs/40555737252), [40556437615](https://github.com/PhQMR7S/Farmakon/actions/runs/40556437615), and [40556674336](https://github.com/PhQMR7S/Farmakon/actions/runs/40556674336) passed **scope only**; baseline/postgres/browser skipped. Scope compares every changed path against fixed F00.9 checkpoint `0bc525e`, restricted to this repository/audit branch and explicit local tooling/workflow/report/evidence paths. Runtime/migration/dependency/existing regression changes would require normal checks. Final documentation/evidence delivery intentionally skips CI; it does not inherit a new integration pass.

## Cleanup, isolation and costs

Corrected run observed `daemon-config-cleanup restored:true`, zero project containers, zero project volumes, private files removed. Cleanup also asserts the dedicated Docker network is absent before emitting success. No test users, emails, PDFs or database were created; no public service ports were opened. No tokens, OTPs, mail bodies, dumps or Docker layers were uploaded to GitHub artifacts, git or Drive. Committed evidence contains public manifests and sanitized counts/errors only.

Opt-in workflow remains independent, contents:read, bounded, without pull_request_target or cloud secrets, not automatic on each push. Standard public runner used; no paid/larger runner or new service/account was enabled. No Production/Staging access or settings change, no Staging role extension (expiry remains 2026-11-02 23:59:59 UTC), no F00.7 index application, no merge/deployment/Issue closure.

## Owner decision and remaining gates

Stop repeated registry attempts. A next authorized attempt requires a concrete different access path: an existing approved runner with safely cached **official digest-verified** layers, or approved registry authentication through secure GitHub secrets with least scope and verified cost/quota terms. Public GHCR anonymous access is documented, but authenticated pull is not proved to fix this particular limit ([GHCR documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)). No new registry account/key, external cache, mirror, proxy/IP rotation or financial commitment was created. Persistent cache capacity/quota was not verified and is not presumed available.

Before F00.11: resolve actual blob pull, start the isolated stack, apply reviewed SQL, pass real Auth/Mailpit/JWT/Storage tests, observe cleanup and repeat successfully on a separate fresh runner. F00.8 real Staging confirmation/recovery/natural JWT/settings gates remain unproved; F00.9 full Auth/Storage restoration remains unproved. PostgreSQL load reproducibility risk remains open. **F00.10.1 stops here with BLOCKED integration; no disaster-recovery drill or next phase started.**
