# Deploy to Vercel

The application consists of the Vite frontend and Node.js functions in **api/**. Use Node.js **22.x**, set the Vercel project root to **id-card-system**, and keep **vercel.json** in that directory.

## 1. Prepare the database

Create a PostgreSQL database (Neon is supported). Copy **.env.example** to **.env.local** and set:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@YOUR-POOLED-HOST/DATABASE?sslmode=require
VITE_DATA_BACKEND=api
IDCMS_ADMIN_EMAIL=your-admin@example.org
IDCMS_ADMIN_PASSWORD=your-unique-password-at-least-12-characters
IDCMS_ADMIN_NAME=Administrator
```

Keep this file private. Only VITE-prefixed variables enter the frontend bundle. DATABASE_URL and administrator credentials must stay server-side. Use Neon's pooled connection URL for serverless deployments.

From **id-card-system** run:

```sh
npm ci
npm run db:setup
npm run admin:create
```

Database setup runs **database/schema.sql**. It creates the member, organisation, administrator and session tables plus indexes and an update timestamp trigger. It does not insert sample members, delete records or change existing administrator passwords. Administrator creation inserts the account only if it does not already exist and stores a salted scrypt hash.

For an existing installation, back up the database and review the schema before applying it. The setup creates missing tables; it is not a migration of incompatible existing columns.

## 2. Verify locally

With the API environment configured, run:

```sh
npm run dev
```

Sign in, create a test member with a photo, check Hindi text and download both PNG and PDF. Change settings and reload to confirm persistence. The development server mounts the same API handlers used in production.

Run the offline checks before deployment:

```sh
npm run check
```

A normal production build always uses the server API. A production build with VITE_DATA_BACKEND=local is rejected, so browser-only development storage cannot accidentally become the deployed register.

**npm run preview** serves the built frontend only; it does not emulate serverless functions. Use it for layout and route checks, or use a Vercel preview for the complete application.

## 3. Configure Vercel

Import the repository or update the existing project:

| Setting | Value |
| --- | --- |
| Root directory | id-card-system |
| Framework | Vite |
| Node.js | 22.x |
| Install command | npm ci |
| Build command | npm run build |
| Output directory | dist |

Set **DATABASE_URL** and **VITE_DATA_BACKEND=api** for every environment you intend to use (Production and, when used, Preview/Development). A preview should use a separate test database. Administrator setup variables are only needed locally for the setup command.

Deploy through the Vercel project dashboard or your existing CI integration. Do not upload only dist to a static host: login, saving and verification require the API functions.

The checked-in SPA rewrite preserves React routes on refresh. API identifiers use the existing query-based routes, for example **/api/member?memberId=PKSDST0001**. Keep **api/_lib/** as shared code rather than public functions.

## 4. Check the deployment

- **/api/health** returns JSON with ok=true. This verifies the function runtime, not database connectivity.
- **/login** loads and a fresh browser is redirected there from **/admin** and **/generate**.
- Anonymous **/api/members** requests return 401.
- Sign in with the administrator created above; create a temporary member, reload and confirm it remains.
- Download a PNG (2500 × 1500) and PDF (85.6 × 51.36 mm). Both preserve the reference card's 5:3 aspect ratio.
- Print on A4 landscape at 100% with background graphics enabled. The card retains its physical size and is centred on the sheet.
- Open **/verify/<memberId>** while signed out. It shows membership status without publishing the photograph or internal notes.
- Confirm **/dev/card** is unavailable in production, then remove the temporary member.

The original reference is a photographed screen. Exact portrait and handwritten-signature reproduction requires the original image assets. The development preview includes an AI-generated fictional sample portrait; real member records use the photograph uploaded for that member.

## Browser regression checks

Start the local development server in browser-storage mode (leave VITE_DATA_BACKEND unset). Start a separate headless Chrome instance with remote debugging on port 9222 and an isolated profile, then run:

```sh
node scripts/check-browser.mjs http://127.0.0.1:5173
```

The script checks desktop/mobile preview, long names, photo rendering, PNG/PDF exports, print markup and the local generator/settings flow. It writes results to the ignored **.artifacts/** directory and only changes data in that isolated browser profile.

### Complete API-backed browser checks

With the same isolated Chrome instance listening on port 9222, start a disposable test application in another terminal:

```sh
npm run dev:test-api
```

Then run:

```sh
npm run test:system
```

The test application binds only to **127.0.0.1:5174**, runs the real API handlers against an in-memory PostgreSQL database through [PGlite](https://pglite.dev/docs/api), and creates a test administrator automatically. It never connects to DATABASE_URL from .env.local. Stop it with Ctrl+C when finished; its records are disposable.

System checks cover login, creation with a portrait, editing, renewal, revocation, generator saves, outage/retry handling, session expiry and 40 page/viewport combinations at 320, 390, 768 and 1440 pixels. Screenshots and results are written to **.artifacts/system/**.

Legacy scripts named **test-api**, **test-prod** and **check-admin** require database credentials and can modify the target database. They are not part of npm run check. Use them only against a deliberately selected test environment.
