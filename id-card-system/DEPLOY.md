# Deploying to Vercel

The app is a static Vite build, so it deploys as-is. No server of your own is
needed.

---

## Option A — Vercel CLI (fastest)

```bash
npm install -g vercel
cd id-card-system
vercel          # first run: log in, pick a project name
vercel --prod   # deploy to production
```

You will get a URL like `https://id-card-system.vercel.app`.

## Option B — Vercel Dashboard (no terminal)

1. Push this folder to a GitHub repository.
2. Go to <https://vercel.com/new>.
3. **Import** the repository.
4. Framework preset: **Vite** (it is detected automatically).
5. Leave Build Command `npm run build` and Output Directory `dist`.
6. **Deploy.**

`vercel.json` already handles SPA routing, so `/verify/0095030` and other deep
links work on refresh.

---

## Login for the demo

```
email:    admin@example.com
password: demo1234
```

---

## ⚠️ Read this before you demo — what is and is not real

The app is currently running in **demo mode**: there is no database.

| Works | Does not work |
|---|---|
| Login, dashboard, add/edit members | Data is **per browser**, not shared |
| Card preview, PNG / PDF / print | A member added on the laptop is **not** on the phone |
| Revoke / renew, status logic | Reloading on another device starts fresh |
| Verification page for the **5 seeded members** (0095030–0095034) | Verification for a **newly added** member |

### The QR scanning trap

If the client scans a card on their phone and that member was typed in on the
laptop, the phone shows **NOT FOUND** — not because the software is broken, but
because there is no shared database yet.

Two ways to demo QR scanning safely today:

- Use one of the **seeded IDs** (0095030–0095034). Those exist on every device
  because each browser seeds them locally.
- Or show the verification page by opening the URL directly:
  `https://YOUR-URL.vercel.app/verify/0095030`

### Turning on a real shared database

1. Create a free project at <https://supabase.com>.
2. Run `supabase/schema.sql` in its SQL editor.
3. Copy `.env.example` to `.env` and fill in the project URL and anon key.
4. Redeploy. The app switches to Supabase automatically — no code change.