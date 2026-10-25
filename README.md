# Farmakon

Arabic pharmacy learning platform. Source imported from the existing private Sites deployment, including exam, subscription and progress fixes.

## Deployment status

- GitHub: PhQMR7S/Farmakon, main.
- Vercel: farmakon, team phqmr7s.
- The existing private deployment remains the working production application.
- Vercel builds are intentionally paused with the ignored-build command `exit 0` until the Cloudflare-specific runtime is migrated. Creating the Vercel project alone does not provide independent student authentication.

## Required migration work

1. Replace Cloudflare D1 access with a Vercel-compatible persistent database and migrate existing data with verified backup/restore.
2. Replace the R2 binding with authenticated object-storage access. Preserve course entitlements and file metadata.
3. Replace trusted ChatGPT identity headers with independent authentication. Disable the first-visitor owner setup and bind administrator ownership explicitly before public release.
4. Switch build/start scripts from Vinext Workers to a Vercel-compatible runtime; run tests and a production build.
5. Configure secrets through provider settings, test account recovery, logout and authorization, then remove the ignored-build command and publish a verified deployment.

No credentials, database exports or student data are stored in this repository. No paid plan has been enabled.
