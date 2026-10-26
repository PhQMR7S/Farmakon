# Farmakon — current implementation status

Verified 2026-10-26. Release remains unapproved. This describes implemented code and observed infrastructure, not a student-launch signoff.

## Current stack
Next.js 16.3.4 / React 19.2.6 / TypeScript, GitHub `PhQMR7S/Farmakon`, Vercel `farmakon`, Supabase Auth, private PostgreSQL schema `farmakon`, private Supabase Storage bucket `farmakon`. Runtime Node 24 on Vercel.

Independent email/password signup, confirmation callback, login, recovery, password reset and local-session logout exist in code. No ChatGPT account is required. Ownership comes from server-configured owner email after verified authentication; editable user metadata cannot grant roles. Live email delivery and full signup/reset lifecycle still require isolated staging verification.

The six PostgreSQL tables are records, settings, members, enrollments, codes and activity. All have RLS enabled; browser roles have no direct table grants. `farmakon_app` has backend CRUD policies: application authorization is essential and RLS is not independent student isolation for that role. Storage policy checks publication/entitlement via a private-schema helper. No production schema or student data was changed in Phase 0.

## Preserved behavior
Course/module/lesson authoring, per-course subscriptions, activation codes, playback position/notes, library, four-option questions, timed exams/resume, announcements, tickets, manual payment review and PWA downloads remain. Approving payment **issues a one-time activation code**; it does not directly enroll a student. The app does not collect funds.

API upload cap is **4 MiB per file**, with an application-level preparatory total cap of 1 GiB. Supabase bucket reports a 50 MiB object limit; this does not increase the Vercel API limit. Drive links remain external and have independent sharing permissions. No automatic Drive organization, transcoding, DRM or paid provider has been enabled.

## Validation and launch gates
See [Phase 0 report](FARMAKON-V2-P0-REPORT.md) for executed checks and remaining blockers. Build/SQLite smoke passes alone do not demonstrate real Auth, Storage RLS, email delivery, backup restoration or 750-user capacity. V2 features must wait for issue #1 gate and default disabled until separately reviewed.

The Supabase leaked-password warning remains open. Official documentation limits that provider feature to Pro and above; no upgrade or settings change was made. Review the risk within the approved budget rather than silently enabling billing.

## Historical record
[Archived Sites-era status](archive/BUILD-STATUS-SITES.md) preserves the prior D1/R2/SIWC implementation notes. Its hosting, authentication and upload statements do not describe the current runtime. Existing historical source data has not been reset or imported by this work.
