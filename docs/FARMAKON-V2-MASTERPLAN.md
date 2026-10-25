# Farmakon V2 — Master Development Plan
Status: APPROVED SCOPE / SPECIFICATION ONLY · 2026-10-25
Owner: Farmakon · Repository: PhQMR7S/Farmakon
Execution handoff: ChatGPT Work (manual start when available). No autonomous/background Work invocation is configured.

## Mission
Turn the existing Arabic-first Iraq-focused pharmacy-learning PWA into a secure, independently authenticated learning platform. Do not clone MedMasters/Osmosis/MedOS branding or protected material. Maintain RTL/English, responsive Android/iOS/web, low-bandwidth performance, accessible light/dark mode and a budget-conscious rollout. **No paid API/gateway/storage plan is authorized by this plan.** Protect the current main branch and production deployment.

## Verified baseline (read-only on 2026-10-25)
- Repo: PhQMR7S/Farmakon; branch main; package.json: Next.js 16.3.4, React 19.2.6, Supabase SSR/JS, pg, Zod, Tailwind 4, TypeScript 5.9.
- Pages: app/platform.tsx, app/login/page.tsx; API: app/api/platform/route.ts, app/api/media/route.ts, app/api/auth/route.ts. PostgreSQL adapter: lib/database.ts; authorization: app/lib/server.ts.
- Current code provides course/module/lesson authoring, course enrollments and activation codes, video speed and per-lesson saved position/note, library files, 4-option MCQ, timed exams, announcements, support, manual payment requests, PWA/offline and owner controls. **Present in code does not mean live end-to-end tested.**
- Vercel project farmakon exists; inspected production deployment READY at main commit 7258c50062f4bb08cdf9686a727953313ad30260. Supabase project Farmakon active; private farmakon schema has records, settings, members, enrollments, codes, activity with RLS enabled.
- Supabase security advisor: leaked-password protection disabled. Prior docs/BUILD-STATUS.md includes old Sites/D1/R2/SIWC limitations and is not the source of truth for the migrated GitHub/Supabase stack. Reconcile docs before feature implementation.
- Public GitHub repo: never commit paid course files, student data, licensed medical source material, secrets or API keys.

## Release principles
1. Phase 0 before any major feature: prove login, owner-only actions, storage entitlement, signup+email verification, reset, account deletion/privacy, backup/restore, RLS, rate limits, price/plan limits; establish complete test environment and no-PII fixture data.
2. Build on existing routes/data carefully; do not reset schema or substitute the system with a generic demo. Preserve existing student progress, entitlements and media.
3. Use separate feature branches and a draft PR per implementable slice. No direct push to main; production only after explicit review, automated tests, preview QA and rollback readiness.
4. Integrate feature flags: each V2 module defaults disabled in production until verified.
5. Clinical content is **education-first**. Clinical calculators/drug references need approved sources, units, contraindications, independent validation, review ownership and version dates before clinical-use claims.
6. AI stays server-side, citation-grounded and entitlement-scoped with opt-in inputs, usage caps, abuse prevention, injection defenses and explicit uncertainty; do not send identifiable patients or student records to unapproved providers.

## Approved feature epics — work items, dependencies, acceptance criteria
### F01 Smart Lecture Center (P1)
- Reuse existing lesson/course/progress. Extract giant app/platform.tsx into testable feature components.
- Implement video/PDF companion tabs: Overview, Notes, Quiz, Flashcards, Resources, Transcript, AI. Use URLs rather than copying restricted bytes to insecure sources.
- Resume position per user/lesson; timestamp bookmarks; drafts/notes with autosave and conflict policy; transcripts with timestamp links; captions, controls, playback speed, mobile fullscreen.
- Restrict lesson attachments to current course entitlement, allow staff review; gracefully handle absent transcript and external Drive preview. Rights-aware offline download/expiry.
- Acceptance: authenticated enrolled student can resume, create/edit own timestamp note, jump to transcript timestamp, see only authorized assets; admin can preview drafts; entitlement revocation immediately blocks new protected requests.
- Tests: player events, mobile RTL, autoplay restrictions, cross-user access, offline expiration, media 403, screen-reader labels.

### F02 Farmakon AI Tutor (P3; needs F01/F07)
- AI answer grounded in whitelisted approved course docs, lecture transcripts and citations (page or time), not web by default. Permission-scoped retrieval, limit token/context/rate/spend; one course/lesson assistant and optionally whole enrolled course view.
- Modes: simplified bilingual explanation, summary, questions, terminology, mind-map outline, revision coach. Show original-source vs generated explanation explicitly.
- "I don't know / not in approved material" fallback; instructor review workflow for any AI-generated published learning assets. Prevent prompt injection from documents and cross-course leaks.
- Feature flag disabled with informative UI when AI provider/budget unavailable; no hardcoded credentials.
- Acceptance: two students enrolled in different courses never receive the other's protected excerpts; all cited answers link to an authorized page/time; invalid/no-source queries do not fabricate citations.
- Tests: retrieval tenant isolation, injection attempts, PII filtering, limits, model errors, source deletions/revocation, Arabic quality rubric.

### F03 Advanced Question Bank (P2)
- Extend current question/exam implementation; introduce versioned questions and answer-key secrecy before upgrading to single/multiple-select, true-false, image-based, matching and faculty-reviewed case-based items.
- Practice mode immediate feedback; exam mode delayed solution; filters for stage, subject, year, topic, difficulty, source, curriculum reference and verified Iraqi ministerial-vs-practice status.
- Custom quiz builder with bounded question count, timed/unlimited modes, randomization with stable attempt snapshot; wrong-answer queue and retakes.
- Acceptance: start/resume/submit idempotently; server decides score; only eligible student sees restricted question; published changes do not corrupt active attempt.
- Tests: cross-user result isolation, timeout/resume, no answer key in GET, duplicate submits, partial scoring, source and difficulty validation.

### F04 Flashcards + Spaced Repetition (P2; needs F03/F01)
- Decks per lesson, teacher-curated published decks and personal cards; bidirectional Arabic/English; images only with rights; import from approved lecture text with human review.
- Use a transparent, tested spaced repetition scheduler (e.g. a pinned and verified FSRS implementation) stored by user+card; ratings Again/Hard/Good/Easy; timezone/day boundary, due counts and offline sync conflict rules.
- Acceptance: independent personal decks, due dates deterministic from review history, cards hidden after enrollment lapse unless explicitly personal/public, no progress shared between accounts.
- Tests: deterministic scheduling fixtures, timezones/DST, review reconciliation, ownership, revocation.

### F05 Smart Study Planner (P2; needs F03/F04/F06)
- Student-defined exam date, availability, priorities, daily study capacity and optional rest days; automatically partition lessons, quizzes and due cards into editable daily tasks.
- Reschedule only future incomplete tasks; never erase completed work. Notifications opt-in, quiet hours and timezone-aware.
- Acceptance: schedule generated from real entitlements and course backlog, user can edit; missing a day reschedules safely; no unrealistic guarantees.
- Tests: exam-date boundaries, DST, empty course, cancellation, cross-account, changing study capacity.

### F06 Student Analytics (P2)
- Reuse progress/activity/attempts but separate lecture viewed vs actually completed, study time vs video play time, quiz mastery, SRS retention, exam results; define metric denominators.
- Student dashboard with daily/week trend, weak areas, completion by course and time ranges; anonymized aggregated instructor dashboard only where justified.
- Acceptance: a student sees only their data; percentages and time have documented formulas; deleted/cancelled attempt not double counted.
- Tests: aggregation correctness, entitlement changes, empty/new accounts, timezone, pagination/performance.

### F07 Advanced Search & Library (P1)
- Search across public/purchased course metadata, lecture titles, authorized question titles, approved searchable PDF text and transcripts; authorization filter at retrieval, not merely UI masking.
- Metadata indexes for stage, year, topic, drug generic name and course; results grouped by lecture/file/question/topic, with deep links and snippets only for entitled content.
- Support saved notes/playlists/download inventory and responsive text size; async indexing job with quotas and text-extraction failure fallback. No copyrighted bulk scraping.
- Acceptance: public user sees only public titles/snippets; enrolled user sees only own accessible full content; removed asset disappears from index; acceptable performance on 750-user target after load test.
- Tests: ACL search leaks, Arabic tokenization, duplicate terms, indexing failure, stale content, no matches.

### F08 Ratings & Instructor Profiles (P4)
- Instructor roles separate from platform owner; owner grants/revokes scoped course editing; profile, credentials (verified display), course catalog, moderation.
- Verified-enrollment course reviews with 1–5 ratings for audio/video, explanation, syllabus fit and value; anti-spam one active review per eligible student/course, edit history and appeals/reporting.
- Acceptance: teacher cannot access another teacher's students, moderation logged, only eligible genuine learners can review and ratings recompute consistently.
- Tests: role escalation, fake reviews, deletion, report workflows, output encoding.

### F09 Clinical & Pharmacy Hub (P5; requires scientific governance)
- Education-only initial drug monographs: generic/trade names, indication, mechanism, contraindications, interactions, references, last-reviewed date and reviewer; copyright/licensing checks.
- Validated calculators as separate modules (BMI, IBW, BSA, eGFR/CKD-EPI, Cockcroft–Gault; optional GCS/Wells after reviews), each with formula/version/source, units, assumptions, limitations, input validation, output interpretation disclaimer.
- Never expose automatic prescribing/recommendations without independent clinical governance. No real patient identifiers retained by default.
- Acceptance: every result independently checked against published examples; invalid inputs rejected; dated citation shown; no clinical claim for unverified modules.
- Tests: property/edge/unit tests, clinical reference values, out-of-range inputs and warnings.

### F10 Interactive Pharmacy Laboratory (P6; needs F09 and expert-authored content)
- Simulation-only cases for prescription checking, dose/unit arithmetic, compounding basics, interactions, pharmacokinetic exercises; reversible educational decisions and explained feedback.
- Case authoring interface and rubric, randomization with reproducibility, accessible touch-first interactions, level progression; no unsafe real-world dosing instructions represented as patient-specific orders.
- Acceptance: learning objectives and source attached to every case, reset/replay, student-scoped grading, instructor-approved content, audit of scoring versions.
- Tests: simulation branching, rubric, restart persistence, RTL/a11y, science review.

## Milestones and dependencies
- P0 Safety and release baseline → F01 + F07 (P1) → F03 + F04 + F06 (P2) → F05 → F02 (P3) → F08 (P4) → F09 (P5) → F10 (P6).
- AI may have a small provider-free UX placeholder in P1; do **not** activate commercial API until budget/consent/terms are approved.
- Each epic has an independent GitHub issue, migration if needed, fixture+unit+integration tests, protected preview review, user documentation, rollback path and cost estimate.
- Explicit "done" means code merged AFTER signed-off tests; writing a plan or creating an issue is NOT implementation.

## Nonfunctional requirements
- Authentication/authorization on the server; RLS defense in depth on exposed schemas; no service-role keys in browser; student/course scoped access and least privilege.
- PWA mobile-first: Arabic RTL by default, English LTR switch, keyboard accessibility, captions and font sizing; low-bandwidth image/video strategies, safe offline caching for authorized content.
- Record consent, retention policy, right to delete/export; never log passwords, raw patient details, secrets, entire AI prompts or protected course text.
- Avoid fragile live dependencies for clinical evidence; pin versions, retain source/reviewer/time on educational assets. Strict budgets and usage metrics before enabling AI and media services.
- Verify 750 concurrent student ambition using actual representative load tests; never claim capacity before measurement.
