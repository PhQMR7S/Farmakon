# F00 personal study-data export — 2026-10-26

Separate draft continuation of PR #14 / issue #1. No main merge, production release, paid service, database schema change or account deletion is part of this slice.

## Behavior
- Account page downloads an authenticated user's study-data JSON through a same-origin POST. The endpoint accepts an empty object, not a user ID/email selector. Authentication comes from the existing verified server identity.
- Export covers the user's profile, enrollments, notes/progress, exam answers and numeric results, payment requests and support tickets. Queries filter on the authenticated user ID/email in SQL and records are scope-checked again before projection.
- This is a study-data copy, not a course-content download or a full administrative export. Excludes question snapshots, correct answers/explanations, course media, activation codes/hashes, audit data, reviewer identities and private fields, including when the caller is the owner.
- No persisted export file or new personal-data table. Response is an attachment with no-store/nosniff headers and a filename without a personal identifier. The downloaded copy is private data under the user's control.
- At most 1,000 rows per collection and a conservative 5 MiB UTF-8 budget, checked before loading record snapshots and again before response. Oversized requests fail explicitly with 413 and support instructions; never silently truncate. Five exports per 15 minutes when the existing server limiter is enabled. No external provider call is made inside the read transaction.

## Isolation and rollout
- New branch `feat/farmakon-v2-p0-privacy` disables its automatic Vercel deployment in branch-specific `vercel.json` configuration, because it must not inherit production database settings. No production/default environment variable was edited. A Vercel attempt to preconfigure an as-yet nonexistent branch was rejected with 400; no successful env changes are claimed from that attempt.
- Configure isolated staging variables and exact Auth redirects before deliberately enabling a preview of this branch. Current live staging remains on PR #14 until then. All existing data/functions are preserved; this is additive code plus a narrow SQL adapter extension for the constant `userId` JSON path.

## Validation and remaining gates
- Backend tests exercise actual handlers against SQLite and, in CI, the production PostgreSQL adapter: two identities, protected snapshot/admin field exclusion, auth/CSRF/body bounds, attachment headers, overflow refusal and live PostgreSQL quota logic. Auth transport remains a fixture in these suites.
- Desktop/Android RTL browser tests exercise actual JSON download and visible throttling errors with a transport fixture. This does not prove live provider Auth or a real-user export download.
- Check the exact PR commit/CI result before claiming these new tests pass. No account export with real personal data has been downloaded or shared by the agent.
- Full account deletion, retention/consent policy and strict session invalidation remain unfinished. A deletion-request ticket would not count as deleting an Auth account. Real second-user staging isolation is still blocked: latest aggregate inspection found one confirmed owner and zero confirmed non-owner users; the browser still showed owner navigation after the user's handoff.
