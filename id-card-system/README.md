# Membership card system

React 19 + Vite application for पूनम कबीरा सर्व धर्म सहायता ट्रस्ट. Includes an authenticated member register, card generation, PNG/PDF downloads, A4 printing, reports and public membership verification.

The card uses the supplied Hindi reference: a 5:3 landscape canvas, rounded gold border, blue/red diagonal bands, portrait emblem, member photo and signatory. Its layout stays fixed on mobile and in exports. QR printing is optional and off by default. The logo and seal are supplied repository assets; upload each member's own photograph.

## Local development

Use Node.js 22 and npm:

```sh
cd id-card-system
npm ci
npm run dev
```

Without configuration, development uses browser storage and the demo login displayed on the login page. This data is isolated to that browser.

Open **/dev/card** to review the reference card without signing in. It supports text/photo changes and PNG/PDF/print checks. This route is excluded from production.

## Checks

```sh
npm run check
```

Runs lint, 44 automated tests (including the real API handlers against isolated PostgreSQL), and the production build. Output: **dist/**. Browser checks are documented in [DEPLOY.md](DEPLOY.md). See [QA.md](QA.md) for coverage and limits.

## Production

Deploy the **id-card-system** directory to Vercel with its **api/** functions and a PostgreSQL database. A static upload of dist alone does not run the API.

See [DEPLOY.md](DEPLOY.md) for environment variables, database schema, first administrator creation and deployment checks. No live deployment or database change is performed by the build.
