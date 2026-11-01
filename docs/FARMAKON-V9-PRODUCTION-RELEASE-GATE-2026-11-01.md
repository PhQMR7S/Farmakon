# Farmakon — V9 Production Release Gate (2026-11-01)

## Scope and ownership
Repository: `PhQMR7S/Farmakon` (not `QMR7S/Q7Farmakon`).
Review branch: `feature/farmakon-auth-v5-real-platform-2026-11-01`, PR #20 (DRAFT).
Approved UI preserved: `public/farmakon-auth.html` (Tajawal/Inter, brand, dark/light, stage/university/governorate, 6-digit OTP).
Original student platform unchanged: `app/platform.tsx`, `app/globals.css`.

## Completed
- Auth code added on original repo: Supabase session SSR, signup, verifySignup/resend, password recovery code, reset password, login/logout.
- New root SSR gate: `app/page.tsx` only renders original `app/platform.tsx` for confirmed Supabase Auth users.
- Recovery code page integrated with same Farmakon login design; old password recovery links are redirected to `/farmakon-auth.html#new-password` to avoid showing outdated styling.
- During production template transition, the signup/recovery UI explicitly accepts **code or secure link**, since production templates were not confirmed to have been switched from `{{ .ConfirmationURL }}` to `{{ .Token }}`.
- Read-only integration preview: `FARMAKON_PREVIEW_READ_ONLY=1` (scoped only to Vercel Preview on this branch). In preview, GET `/api/platform` does not write members; platform and media POST reject writes; Auth signup, recovery, verification, and reset are blocked on this production-connected preview. Existing login/logout are allowed.
- Vercel build at `33e9eeb25b1a7b30620e8162a48f915752c5e4c5`: READY, Next.js compilation and TypeScript completed. Preview URL: https://farmakon-6r4bgj289-phqmr7s.vercel.app/login
- Separate staging Auth OTP preview: https://farmakon-62x105o15-phqmr7s.vercel.app/login. It is an isolated OTP-test success-page deployment, not the production student platform.
- Production GitHub main and `farmakon.vercel.app` have **not** been modified.

## Critical release blockers — do not claim production onboarding is ready
1. Production Supabase **custom SMTP** has not been confirmed active. Current Supabase default SMTP cannot serve general external students. Set up the already-approved Farmakon Gmail SMTP directly in production dashboard, without exposing app password: https://supabase.com/dashboard/project/zviqtacbsprewyxrmpbb/auth/smtp
2. Production **Confirm sign up** template has not been confirmed switched to six-digit code. Must save `docs/email-templates/farmakon-confirm-signup-otp.html` on https://supabase.com/dashboard/project/zviqtacbsprewyxrmpbb/auth/templates with `{{ .Token }}`.
3. Production **Reset password** template separately requires `docs/email-templates/farmakon-reset-password-otp.html` with `{{ .Token }}`.
4. Production `Authentication > Providers > Email` should confirm OTP length=6 and lifetime=1800 seconds, verify email confirmation requirement is enabled, and check actual sender rate limit.
5. Confirm site URL `https://farmakon.vercel.app` and exact `/auth/callback` redirect configuration. With six-digit templates, callback is used primarily for backward-compatible legacy links.
6. Test external new-address signup email, OTP verify to original student dashboard `/`, login/logout, duplicate email handling; then recovery OTP and change password, using at least one controlled non-owner account.
7. Verify user media and student APIs in a staging DB with real test records or perform controlled production smoke after rollout. The read-only Preview cannot show successful writes or editing.
8. Complete build + integration checks, and review with owner before final merge/promote.

## Policy
Because production email still depends on default template/SMTP until confirmed, **do not merge PR #20 or switch production templates individually**. Coordinate backend, sender and both templates with final release. Do not copy staging Auth secrets, credentials or an invalid DB connection to production. The user has requested a successful, no-regression release; leave the live site unchanged until these checks pass.
