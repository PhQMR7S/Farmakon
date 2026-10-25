# Farmakon

Pharmacy learning platform. Source migration from the existing private deployment.

The current application uses Cloudflare D1/R2 and ChatGPT identity. Vercel migration requires a compatible database, object storage and independent authentication before release. Do not expose trusted identity headers or enable first-visitor owner setup on a public deployment.
