# Farmakon V10.1 — Student App Shell and Navigation / Review Report

**Review date:** 2026-11-02  
**Repo:** PhQMR7S/Farmakon  
**Branch:** `feature/farmakon-v10-1-app-shell-2026-11-02`  
**Status:** Draft preview only; not merged into `main`.

## Approved visual identity
- Keep the original approved sign-in/registration interface unchanged.
- Extend its visual tokens to internal UI: dark `#060A22`, surface `#0D1336`, cyan `#3FBAFD`, warm accents, Tajawal (Arabic) / Inter (English).
- Maintain full light/dark/system preferences, reducing motion, glass overlays with legible contrast.

## Implemented: exactly V10.1
1. **Smart Header**: compact current-section heading, search button, desktop theme control, avatar shortcut to More; replaces overlarge installation CTA in the header (installation remains in More).
2. **Bottom Navigation (mobile)**: Home | Courses | Learning | Library | More. Learning is a legitimate *sheet linking to existing* courses, questions and examinations; not a fake standalone section. Administration retains the working admin tabs and can reach all sections via sidebar.
3. **Sidebar**: stable desktop width, collapsible to icon rail, persisted in localStorage, and responsive mobile drawer. Existing navigation, owner-mode switch, account/logout retained. Mobile drawer has Escape / Tab focus handling and background scroll locking.
4. **Functional global search**: actual published courses and files returned by `/api/platform`; admins can inspect their own drafts. Results navigate to existing sections, and course results open the actual course details. No invented search records or non-existent endpoints.
5. **Accessible sheets**: Search, Learning and More have role=dialog, aria-modal, keyboard focus handling, Escape close, backdrop click, proper scroll behaviour, and mobile bottom-sheet sizing. All controls perform existing actions.
6. **Responsive CSS**: correct safe-area offsets and content bottom padding, 320px–desktop provisions, coherent widths/spacing, animated navigation states, high contrast/reduced-motion fallbacks. On mobile the closed sidebar is not keyboard-focusable.
7. **Loading**: replace large, isolated spinner card with skeleton representation (headline, stats, content); failures preserve explicit retry message.
8. **Scope protection**: no API, Supabase Auth, enrollment, subscriptions, content models, media/player or login files changed.

## Technical checks completed
- Full Next.js build **READY** on Vercel including TypeScript (preview deployment before documentation).
- 11 static source checks passed: genuine data search, menu sections, safe area, closed drawer focus exclusion, exact tokens, skeleton, reduced motion, no backend/auth edits.
- GitHub compare with main: exactly 3 app/style files changed before writing this report; no DB schema changes.
- Vercel Preview scoped flag `FARMAKON_PREVIEW_READ_ONLY=1` configured on this feature branch: blocks platform/media writes and Auth mutations when the preview is production-data-connected.
- No merge to production. Keep full current platform fully functional in `main`.

## Manual/device verification required before acceptance and merge
1. Login with previously confirmed test account on preview (Vercel preview protection may require team login).
2. **320 / 360 / 390 / 430 / 768 / 1366px**: no horizontal scroll; bottom dock never covers last course/footer; mobile drawer remains inside viewport.
3. Open/close Drawer with toggle, backdrop, Escape; verify focus trap and no scrolling behind open overlay. Ensure all student and owner links remain reachable.
4. Search published course and file names, select results and check correct target section/detail. Verify empty search feedback.
5. Learning sheet links to Courses, Question Bank and Exams; More links to Account, Subscriptions, Downloads, Support, Theme and Install.
6. Switch dark/light/system; ensure contrast in course cards, modals, inputs, player, RTL.
7. Check navigation and browser back, course → lesson, student activities and quiz history; check that progress remains unchanged.
8. Test Android browser with software keyboard open and iPhone Safari safe-area.
9. Run automated functional/a11y E2E when a protected preview can be opened by authenticated test browser. Visual QA on actual devices not proven by build alone.

## Release policy
This is a UI shell-only review. Keep PR draft, do not merge or publish to `farmakon.vercel.app` before owner reviews the preview and all functional tests pass.

## Planned subsequent milestone
V10.2 — Student Dashboard personalization, Continue Learning, real progress data, course summaries. **Not part of current branch.**
