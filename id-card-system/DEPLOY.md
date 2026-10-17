# Deploying

The app is a Vite front end plus serverless functions in `api/`, all served by
Vercel. There is no server of your own to run and no build step beyond the one
Vercel already performs.

---

## Where it is now

| | |
|---|---|
| Site | <https://id-card-generator-chi-one.vercel.app> |
| Vercel project | `id-card-generator` (root directory `id-card-system`) |
| Database | Neon (Postgres), project `id-card-system` |
| Sign-in | `admin@punamkabira.org` / *(seeded password - kept out of this public repo)* |

Change the seeded password from **Settings → Security** after signing in.

---

## Deploying

The repository root holds the Vercel link file (`.vercel/project.json`), so the
command runs from the **parent** folder, not from `id-card-system`:

```bash
cd C:\Users\hjha7\OneDrive\Desktop\id
vercel deploy --prod --yes --scope jhaharsh94s-projects
```

Expect `▲ Aliased https://id-card-generator-chi-one.vercel.app`.

---

## Environment variables

Set in the Vercel dashboard (Project → Settings → Environment Variables), or
with the CLI.

| Name | Where | Value |
|---|---|---|
| `DATABASE_URL` | Production, Development | the **pooled** Neon connection string |
| `VITE_DATA_BACKEND` | Production, Development | `api` |

Notes:

- Use the **pooled** endpoint (host contains `-pooler`). Functions open a
  connection per request; a direct endpoint would run out of connections.
- `DATABASE_URL` must **never** be prefixed `VITE_`. Vite inlines every `VITE_`
  variable into the public JavaScript bundle, where any visitor can read it.
  Nothing in the browser should ever see a database credential — it calls
  `/api` and that is all.
- `VITE_DATA_BACKEND` bakes in at build time: unset means `api` for
  `npm run build` and `local` for `npm run dev`. Setting it to `api` explicitly
  just makes the intent obvious.
- Preview deployments are not configured (the variable cannot be attached to the
  production branch `main`), so a preview build would have no database. Deploy to
  production.

---

## What is public and what is not

The register holds identity documents, so only these routes answer without a
session:

- `/login`
- `/forgot-password`
- `/verify/:memberId` — the QR destination. A person scanning a card has no
  account, so this must never require one.

Everything else, including the landing page and `/generate`, redirects to
`/login`. There is no client-side "admin" flag to forge; the check is the
session cookie, verified server-side.

There is no mail service wired up, so password recovery is **the administrator
resetting it** — from Settings → Security, or on the server with
`node scripts/make-admin.mjs <password> <email> <name>`.

---

## ⚠️ The API routing constraint

`vercel.json` carries a catch-all rewrite (`/(.*)` → `/index.html`) so client
routes such as `/verify/0095030` work on refresh.

**That rewrite shadows every dynamic function route.** `/api/members/:id`
silently returns the HTML shell — a 200 whose body is a page, which a `fetch()`
would then try to parse as JSON.

For that reason **every file in `api/` must be a flat path**:

```
api/members.js             ✅   /api/members
api/member-row.js          ✅   /api/member-row?id=…
api/members/[id].js        ❌   shadowed
```

Pass identifiers as query parameters (`?id=`, `?memberId=`), not path segments.
This is the one part of the API layout that looks arbitrary and is not.

---

## Verifying a deployment

```bash
node scripts/test-api.mjs     # handlers against the real database, unit-style
node scripts/test-prod.mjs    # the deployed API, session + CRUD + public verify
node scripts/check-admin.mjs  # the deployed app in a real browser
```

`check-admin.mjs` needs headless Chrome listening on port 9222:

```bash
Start-Process "C:\Program Files\Google\Chrome\Application\chrome.exe" -ArgumentList `
  '--headless=new','--remote-debugging-port=9222',
  '--user-data-dir=%TEMP%\chrome-cdp','--no-first-run','about:blank'
node scripts/check-admin.mjs
```

It seeds a few members, signs in through the real form, and asserts the
dashboard and table actually show them — then signs out and removes them, so it
leaves the database exactly as it found it.

### First run on a fresh machine

```bash
cp .env.example .env.local      # then put DATABASE_URL in it
npm install
npm run dev
```
