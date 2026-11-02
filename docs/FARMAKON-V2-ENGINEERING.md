# Farmakon V2 — Technical Architecture & Work Breakdown
Status: design-only; no production schema changes authorized.
Read in tandem with FARMAKON-V2-MASTERPLAN.md and FARMAKON-V2-QA-RELEASE.md.

## Observed code architecture (as of 2026-10-25)
- Next.js App Router 16, React 19, TS, package-lock.json npm; app/platform.tsx (~60KB source) is a client-side monolith containing most UI and state.
- app/api/platform/route.ts (~16KB) combines many actions for content, quizzes, enrollments, orders, support and progress. Zod validation on current records.
- app/lib/server.ts: Supabase getUser(), owner by FARMAKON_OWNER_EMAIL (server-only); record/rows/write and access/canRead helper.
- lib/database.ts: pg Pool with a SQLite-like prepared-statement adapter and SQL text substitutions. Existing scripts should NOT be assumed general-purpose SQL ORM: several substitutions target only six known tables and query shapes. New features should prefer dedicated parameterized SQL repositories/migrations and an explicit SQL contract.
- app/api/media/route.ts: authenticated media; lib/storage.ts Supabase Storage, access checks to preserve.
- Private schema farmakon currently has six tables (records, settings, members, enrollments, codes, activity). Some content is stored as JSON in records; do not force every module into records indefinitely.
- Current test tests/backend-smoke.mjs exercises SQLite in-memory/transpiled API routes (good for legacy regressions, not proof of live PostgreSQL or Supabase RLS). Plan an isolated PostgreSQL/Supabase integration suite.

## Proposed refactor WITHOUT a big-bang rewrite
app/
  (student)/...                # only if routes can migrate without breaking existing "/"
  api/v2/{lectures,search,questions,flashcards,planner,analytics,ai,reviews,clinical,simulations}/route.ts
components/farmakon/
  lecture/{LecturePlayer,LessonTabs,Transcript,TimestampNotes}.tsx
  search/{GlobalSearch,SearchResults}.tsx
  qbank/{QuestionRunner,QuizBuilder,AnswerExplanation}.tsx
  flashcards/{CardReview,Decks,DueToday}.tsx
  planner/{PlanEditor,DailyTasks}.tsx
  analytics/{StudyDashboard,MasteryTopics}.tsx
  ai/{TutorChat,CitationChip}.tsx
lib/farmakon/
  authz.ts                      # entitlement and role policy centrally tested
  repositories/*.ts             # parameterized SQL, NO string-concatenated SQL values
  services/*.ts                 # pure testable domain code
  schemas/*.ts                  # Zod request/response validation
  metrics.ts                    # documented formulas
  flags.ts                      # fail-closed feature switches
  audit.ts                      # admin actions, metadata only
  clinical/*.ts                 # validated pure calculator functions

Use these paths as guidance, not mandatory rewrites. Do not introduce a new library/framework merely for layout. Keep /api/platform backward compatible or gradually deprecate once V2 endpoints have tests.

## Minimum new data contracts (PROPOSED, not applied)
Prefer normalized tables under private farmakon schema and consistent auth account IDs. Work must first inspect actual PostgreSQL DDL including triggers/indexes/grants; write additive versioned migrations and transaction-safe backfill.

- course_instructors(id, course_id, member_id, role, verified_by, created_at)
- lesson_transcripts(id, lesson_id, language, status, version, storage_asset_id, approved_by, created_at)
- lesson_bookmarks(id, student_id, lesson_id, second, label, created_at)
- lesson_notes(id, student_id, lesson_id, second NULL, note, updated_at, version)
- question_items(id, course_id, topic, format, difficulty, stem_json, options_json, answer_json, explanation_json, source_ref, version, status, reviewer_id)
- question_attempts(id, student_id, exam_id NULL, immutable_snapshot, started_at, deadline_at, status, submitted_at, score)
- card_decks(id, owner_id NULL, lesson_id NULL, course_id, visibility, status)
- cards(id, deck_id, front_json, back_json, source_ref, version)
- card_review_state(student_id, card_id, scheduler_version, due_at, stability, difficulty, reps, lapses, last_reviewed_at)
- card_review_events(id, student_id, card_id, rating, reviewed_at, scheduler_input, scheduler_output, idempotency_key)
- study_plans(id, student_id, exam_date, timezone, daily_minutes, preferences, revision)
- study_tasks(id, plan_id, course_id, lesson_id NULL, card_id NULL, kind, due_on, state, completed_at)
- topic_progress(student_id, course_id, topic_id, metric_version, attempts, accuracy, last_activity_at)
- knowledge_assets(id, course_id, kind, source_id, language, status, version, checksum, created_at)
- search_chunks(id, knowledge_asset_id, course_id, chunk_index, text_excerpt, tsvector_or_index, location_json, status) — NEVER expose directly to unauthorized client.
- tutor_sessions(id, student_id, course_id, lesson_id NULL, created_at, deleted_at); tutor_messages(id, session_id, role, redacted_text, citations_json, provider_meta_redacted)
- course_reviews(id, student_id, course_id, ratings_json, text, status, created_at, updated_at)
- drug_monographs(id, generic_name, fields_json, evidence_json, reviewer_id, reviewed_at, published_at, version)
- calculator_references(id, slug, formula_version, primary_source, reviewer_id, published_at)
- lab_cases(id, course_id, title, definition_json, scoring_version, source_ref, reviewer_id, status)
- lab_attempts(id, student_id, case_id, snapshot_json, scoring_version, score, submitted_at)
- audit and consent retention: use metadata and deletion policies, not raw student transcripts or private clinical content.

If possible, reuse existing record IDs and activity for backward compatibility while migrating. Reject same-origin CSRF bypass and IDOR on every mutation. Note that Supabase Auth user_metadata is user-editable and must NOT grant admin/instructor access. Role assignments server-verified; in private schemas explicitly revoke broad privileges and inspect RLS. Test full user deletion including exported/offline caches.

## API/RBAC contract
- Role model: owner > platform_admin > academic_editor > scoped_instructor > support_agent > student. Never infer from public profile or user-provided JWT metadata.
- Every read/write takes verified auth user, checks course status + entitlement + tenant/teacher scope server-side. "Free" lessons still require published course and correctly labeled access.
- Public discovery returns only approved public metadata. Search/AI snippets and private question answer keys are protected even in search endpoints, cache keys, errors and server logs.
- Define idempotency tokens for exam submission, flashcard review and background progress autosave. Use DB transactions and uniqueness constraints.
- Validate data with strict Zod schemas; central 401 unauthenticated/403 unauthorized/404 hidden resource/409 conflicts/429 limits; cap uploads and accepted types; sanitize transcript display and HTML.
- Events: lesson_started/position/completed, quiz_started/submitted, card_reviewed, study_task_completed. Store minimal event data; define student metrics separately.
- Storage/download: signed short-lived access tokens/URLs only with consistent time-bound entitlement checks; no promise of DRM or unextractable media; avoid proxying multi-gigabyte media through Vercel functions.

## Domain specifics and algorithms
- Notes/bookmarks: server timestamps and revision tokens prevent stale-device clobbering. Autosave debounce with retry; avoid storing full private notes in shared cache.
- SRS: prefer pinned reviewed FSRS package or a deterministic implementation validated with reference fixtures; due scheduling server canonical UTC plus per-user local day; preserve a review event log.
- Search: start with Postgres full-text/trigram where suitable and a tested Arabic tokenizer/normalizer; index only authorized, licensed assets and include language, stage, subject and page/time. Embeddings optional later only if budget and controls approved. Revoke index chunks transactionally when assets unpublished.
- Planner: pure deterministic allocation from available time + overdue workload + exam deadline + lesson length + SRS due cards. Explain scheduling; prevent negative capacity.
- Analytics: progress complete has explicit threshold + completion event; never equate autoplay video seconds with attention; exact numerators/denominators and UTC/local date interpretation.
- AI: client submits allowed course/lesson and question; server enforces entitlement, selects only approved chunks, instruments token quota, redacts sensitive inputs, obtains provider answer, validates citations to retrieved chunk IDs and formats Arabic/English. No blind trust of prompt/document instructions. May start with fully offline/demo disabled stub.
- Instructor reviews: enforce one review per eligible student/course, moderated text, no self-review, no uncontrolled deletion; visible aggregate with count.
- Clinical: calculator pure funcs with named version, approved source, units, boundary checks. Educational monographs authored/licensed and reviewed; never scrape proprietary AMBOSS/UpToDate pages or reuse their content without permission.
- Lab: simulation-only case graphs plus deterministic scoring, reviewed by faculty; no real patient/order capture.

## Security audit backlog discovered
- Supabase advisor warning: leaked-password protection disabled; review enabling through official Auth settings before broad launch.
- Verify Auth email-confirmation flow, SMTP quotas, redirect allowlist, reset and sign-out invalidation; session separation; rate limiting login and write endpoints.
- Test lesson access/role scopes, feedback/reviews ownership, server-rendered strings XSS escaping, asset indexing and AI retrieval leakage, and abuse budgets.
- Current repo README describes independent auth, while docs/BUILD-STATUS.md has old Sites-era statements. Update after verifying actual live state; do not delete historical notes without migration trail.
- Ensure current integration tests run against temporary Postgres before replacing adapter or altering schema. Supabase RLS is enabled on currently observed farmakon tables, but per-role policies/grants need review.

## Work branch strategy
- docs-only planning branch = planning/farmakon-v2-work-handoff-2026-10-25; leave as draft PR, NOT production.
- Implement slices using feat/farmakon-v2-p0, feat/farmakon-v2-lecture-search, feat/farmakon-v2-qbank-srs, feat/farmakon-v2-planner-analytics, feat/farmakon-v2-ai, feat/farmakon-v2-instructors, feat/farmakon-v2-clinical, feat/farmakon-v2-lab.
- Each slice: inspect baseline → migration → service/API → client UI → automated tests → preview QA → review → explicit release decision.
