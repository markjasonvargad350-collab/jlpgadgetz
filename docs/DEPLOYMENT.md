# 🚀 Deployment Guide — iStore

This guide deploys iStore to a **free, production-grade stack**:

| Piece | Host | Why |
|-------|------|-----|
| **Frontend** (React/Vite SPA) | **Vercel** | Global CDN, zero-config Vite builds, instant rollbacks |
| **Backend** (Express API) | **Render** | Simple Node web service, Blueprint-as-code, free tier |
| **Database** (PostgreSQL) | **Neon** | Serverless Postgres, generous free tier, already used in dev |

> This is a **configuration + runbook**. It does not deploy anything for you and
> needs no credentials in the repo. Follow the parts in order — each ends with a
> check before you move on. Everything here honors the project's security rules:
> **no secrets in the repo, no secrets in the frontend, default admin/staff
> passwords are refused in production.**

```
                 HTTPS                      HTTPS (CORS + cookie)                TLS
  Browser  ───────────────▶  Vercel  ┊  ───────────────────────▶  Render  ───────────▶  Neon
  (SPA)     static assets   (CDN/SPA) ┊   /api/* → Express API     (Node)   SELECT/…   (Postgres)
                                      ┊
              VITE_API_URL = https://<render-app>.onrender.com/api
```

---

## Contents

1. [Prerequisites](#0-prerequisites)
2. [Part A — Database (Neon)](#part-a--database-neon)
3. [Part B — Backend API (Render)](#part-b--backend-api-render)
4. [Part C — Frontend (Vercel)](#part-c--frontend-vercel)
5. [Part D — Wire the two origins together](#part-d--wire-the-two-origins-together)
6. [Seed production (one time)](#seed-production-one-time)
7. [Post-deploy verification](#post-deploy-verification)
8. [The cross-origin cookie caveat (read this)](#the-cross-origin-cookie-caveat-read-this)
9. [Redeploys, rollbacks & migrations](#redeploys-rollbacks--migrations)
10. [Free-tier caveats](#free-tier-caveats)
11. [Custom domains (optional)](#custom-domains-optional)
12. [Troubleshooting](#troubleshooting)
13. [Environment variable reference](#environment-variable-reference)

---

## 0. Prerequisites

- The repo is pushed to **GitHub** (Vercel + Render deploy from a Git repo).
- Free accounts on **[Neon](https://neon.tech)**, **[Render](https://render.com)**, and **[Vercel](https://vercel.com)**.
- A password manager to hold the production `JWT_SECRET`, admin/staff passwords, and the DB URL.
- Locally: `openssl` (for generating a secret) and this repo checked out.

Config files this guide uses (already in the repo):

- [`render.yaml`](../render.yaml) — Render Blueprint for the API.
- [`client/vercel.json`](../client/vercel.json) — Vercel SPA config.
- [`server/.env.production.example`](../server/.env.production.example) — server env checklist.
- [`client/.env.example`](../client/.env.example) — `VITE_API_URL` reference.

---

## Part A — Database (Neon)

1. Neon → **New Project**. Pick a region **close to your users and to Render** — for the Philippines, **Singapore (`ap-southeast-1`)** pairs with Render's `singapore` region. Name the database e.g. `neondb`.
2. Open **Connection Details**. Neon shows two kinds of string:
   - **Direct** (host like `ep-xxx.ap-southeast-1.aws.neon.tech`) — use this one.
   - **Pooled** (host contains `-pooler`) — for serverless/many-short-connections; not needed for a single long-running Render service.
3. Copy the **direct** connection string. Make sure it ends with **`?sslmode=require`** (Neon requires TLS). This is your `DATABASE_URL`:
   ```
   postgresql://USER:PASSWORD@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```

> ℹ️ **Migrations run automatically** on deploy (`prisma migrate deploy` in the
> API's start command), so you do **not** create tables by hand. You only need
> the connection string. Seeding is a separate, deliberate step (Part 6).

✅ **Check:** you have a `DATABASE_URL` ending in `?sslmode=require`, saved in your password manager.

---

## Part B — Backend API (Render)

The repo ships a **Blueprint** ([`render.yaml`](../render.yaml)) so Render provisions the service for you.

### B1. Create the service

1. Render → **New → Blueprint**.
2. Connect your GitHub repo and select it. Render detects `render.yaml` and shows a service named **`istore-api`** (Node, region `singapore`, root directory `server`).
3. Click **Apply**. Render will prompt for the env vars marked `sync: false`.

### B2. Fill the environment variables

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | the Neon **direct** string from Part A (with `?sslmode=require`) |
| `CLIENT_URL` | leave a placeholder for now (e.g. `https://example.vercel.app`); you'll set the real Vercel URL in Part D |
| `ADMIN_EMAIL` | your real admin email |
| `ADMIN_PASSWORD` | a **strong, non-default** password (not `ChangeMe123!`) |
| `STAFF_EMAIL` | your staff email |
| `STAFF_PASSWORD` | a **strong, non-default** password (not `StaffPass123!`) |

`NODE_ENV=production`, `JWT_EXPIRES_IN=7d`, and a strong random `JWT_SECRET` are set automatically by the Blueprint (`JWT_SECRET` uses Render's `generateValue`). `PORT` is injected by Render — leave it unset.

> 🔒 If `NODE_ENV=production` and any of `JWT_SECRET`/`ADMIN_PASSWORD`/`STAFF_PASSWORD`
> is weak or a known default, or `CLIENT_URL` is `localhost`/non-https, **the app
> refuses to boot** and logs which var is wrong. That's by design — check the
> Render logs and fix the value.

### B3. Deploy

Render runs the Blueprint's commands:

- **Build:** `npm install --include=dev && npm run prisma:generate && npm run build`
  (installs deps **including devDependencies** → generates the Prisma client → compiles TypeScript to `dist/`)
  > `--include=dev` matters: `NODE_ENV=production` makes npm skip devDependencies by
  > default, but `prisma`, `typescript`, and `tsx` are devDeps needed to build (and seed).
- **Start:** `npm run prisma:deploy && npm start`
  (applies pending migrations, then runs `node dist/server.js`)

The **health check** hits `/api/health`, which pings the DB and returns `200` (`{ "status": "ok", "db": "up" }`) when healthy or `503` when the DB is unreachable.

✅ **Check:** open `https://<your-app>.onrender.com/api/health` → you get `{"status":"ok","db":"up",...}`. Note this API base URL — you'll need it (with `/api` appended) in Part C.

---

## Part C — Frontend (Vercel)

1. Vercel → **Add New… → Project**, import the same GitHub repo.
2. **Root Directory:** set to **`client`** (the SPA lives there). Vercel auto-detects the **Vite** framework and reads [`client/vercel.json`](../client/vercel.json) (build `npm run build`, output `dist`, SPA rewrite so client-side routes like `/shop`, `/product/…`, `/admin` all serve `index.html`).
3. **Environment Variable** — add:

   | Name | Value |
   |------|-------|
   | `VITE_API_URL` | your Render API base **with `/api`**, e.g. `https://istore-api.onrender.com/api` |

   > ⚠️ The `/api` suffix is **required**. The client calls bare paths (`/products`,
   > `/admin/orders`); in dev the Vite proxy adds `/api`, but in production
   > `VITE_API_URL` must include it. No trailing slash after `/api`.
   >
   > `VITE_*` vars are compiled into the static bundle at build time — this is a
   > **public** URL, never a secret. (Real secrets stay on Render.)

4. **Deploy.**

✅ **Check:** the Vercel URL loads the storefront and shows products (the catalog is fetched from the Render API). If the page loads but products don't, jump to Part D — it's almost always CORS/`CLIENT_URL`.

---

## Part D — Wire the two origins together

The frontend (Vercel) and API (Render) are on **different origins**, so the API must explicitly allow the frontend for **CORS** and **CSRF**.

1. Copy your final Vercel URL, e.g. `https://istore.vercel.app`.
2. Render → `istore-api` → **Environment** → set:
   ```
   CLIENT_URL=https://istore.vercel.app
   ```
   Add more origins comma-separated if you use several (apex + www + a stable preview):
   ```
   CLIENT_URL=https://istore.vercel.app,https://www.yourdomain.com
   ```
   No trailing slashes, https only.
3. Save → Render redeploys. `CLIENT_URL` drives **both** the CORS allowlist and the CSRF `Origin` check, so this single value connects the two.

✅ **Check:** reload the Vercel site — products load, and (see the caveat below) admin login at `/admin` succeeds.

---

## Seed production (one time)

Migrations create the **empty** schema; seeding loads the admin/staff users, categories, demo products, and sample orders. Do this **once**, deliberately.

**Option 1 — Render Shell (recommended).** Render → `istore-api` → **Shell**:
```bash
npm run seed
```
The service already has `DATABASE_URL`, `ADMIN_PASSWORD`, `STAFF_PASSWORD` in its environment, so the seeded admin/staff accounts use **your** production passwords.

**Option 2 — from your machine.** Point a local shell at the prod DB for one command (don't save it to `.env`):
```bash
cd server
DATABASE_URL="<neon-direct-url>" \
ADMIN_EMAIL="you@domain.com" ADMIN_PASSWORD="<strong>" \
STAFF_EMAIL="staff@domain.com" STAFF_PASSWORD="<strong>" \
npm run seed
```

> The seed is written to be idempotent-friendly for the demo dataset, but treat
> it as a **one-time** bootstrap. Re-running it is only for resetting demo data.

✅ **Check:** log in at `https://<vercel-url>/admin` with your `ADMIN_EMAIL` / `ADMIN_PASSWORD`. The dashboard shows KPIs and products.

---

## Post-deploy verification

Run through this after Parts A–D + seeding:

- [ ] `GET https://<render>/api/health` → `{"status":"ok","db":"up"}`
- [ ] Storefront loads on the Vercel URL; catalog shows products.
- [ ] Search / filter / sort / pagination work (they hit the live API).
- [ ] Open a product → select a variant → **Add to cart** → **Checkout** → place a **guest** order → confirmation screen shows an order number.
- [ ] **Track Order** with that order # + the email used → map + timeline render (labelled *Simulated · not live GPS*).
- [ ] `/admin` login works with your production admin password.
- [ ] Admin: adjust stock / advance an order status — changes persist on reload.
- [ ] Browser devtools **Network**: API responses carry `X-Request-Id`, `Content-Encoding: gzip`, and public catalog GETs show `Cache-Control: public, …` while admin/order responses show `no-store`.
- [ ] A cross-site `POST` with a spoofed `Origin` is rejected — verify from a shell (browsers can't set `Origin`):
      ```bash
      curl -i -X POST https://<render>/api/admin/auth/login \
        -H "Origin: https://evil.example.com" -H "Content-Type: application/json" \
        -d '{"email":"x@x.com","password":"x"}'
      # → HTTP/1.1 403  … "code":"CSRF_BLOCKED"
      ```

---

## The cross-origin cookie caveat (read this)

Admin auth uses an **HttpOnly cookie**. Because the SPA (Vercel) and API (Render)
are on **different sites**, in production the cookie is sent with
`SameSite=None; Secure` — a **third-party cookie** from the browser's point of
view. This works today in Chrome/Edge/Firefox, **but Safari (and any browser with
third-party cookies disabled) will block it**, so admin login can silently fail
there. The **customer storefront is unaffected** — guest checkout uses no cookies.

You have two options:

**Option 1 — Keep cross-origin (default).** Simplest; matches how the app is
built (`VITE_API_URL` → Render, CORS + `SameSite=None`). Fine if admins use
Chrome/Edge/Firefox. This is what Parts A–D set up.

**Option 2 — Same-origin via a Vercel proxy (most robust).** Make the browser see
one origin so the cookie is **first-party**. Add a rewrite so Vercel forwards
`/api/*` to Render, and point the client at its own origin:

- In `client/vercel.json`, add (keep the SPA rewrite **last** — order matters):
  ```json
  {
    "$schema": "https://openapi.vercel.sh/vercel.json",
    "framework": "vite",
    "buildCommand": "npm run build",
    "outputDirectory": "dist",
    "rewrites": [
      { "source": "/api/(.*)", "destination": "https://istore-api.onrender.com/api/$1" },
      { "source": "/(.*)", "destination": "/index.html" }
    ]
  }
  ```
- Set `VITE_API_URL` **empty** (or unset) on Vercel so the client calls same-origin `/api`.
- Keep `CLIENT_URL` on Render pointing at the Vercel origin — the forwarded
  `Origin` header is still the Vercel origin, so CORS/CSRF checks still pass.

Trade-off: every API call now hops Browser → Vercel edge → Render (a little extra
latency and Vercel bandwidth), in exchange for first-party cookies that work
everywhere. Choose Option 2 if admins use Safari or you want maximum robustness.

---

## Redeploys, rollbacks & migrations

- **Redeploy:** push to the connected branch. Render and Vercel both auto-deploy (`autoDeploy: true`).
- **New DB migration:** create it locally against a dev DB (`npm --prefix server run prisma:migrate --name <change>`), commit the generated folder under `server/prisma/migrations/`, and push. On deploy, `prisma migrate deploy` applies it to Neon automatically. **Never** run `migrate dev` against production.
- **Rollback:** Vercel keeps every deployment — **Promote** a previous one instantly. Render → **Deploys** → **Rollback** to a prior build. Note: a rollback does **not** revert DB migrations — write migrations to be backward-compatible.
- **Paid-tier tip:** on a Render paid plan, move `npm run prisma:deploy` from `startCommand` into `preDeployCommand` (in `render.yaml`) so migrations run **once per deploy** instead of on every cold-start boot.

---

## Free-tier caveats

- **Render free web service sleeps** after ~15 min idle; the next request cold-starts (a few seconds, plus the `migrate deploy` check). Upgrade to `starter` (~$7/mo) in `render.yaml` (`plan: starter`) for always-on.
- **Neon free** autosuspends the compute after inactivity and resumes on the next query (sub-second). Fine for a demo; the first query after idle is slightly slower.
- Combined effect: the very first request after a quiet period may take a few seconds. Subsequent requests are fast. A simple uptime pinger against `/api/health` can keep Render warm if you want.

---

## Custom domains (optional)

- **Vercel:** Project → **Domains** → add `yourdomain.com` (and `www`). Vercel provisions TLS.
- **Render:** Service → **Settings → Custom Domains** → add `api.yourdomain.com`; add the shown CNAME at your DNS provider.
- **Then update:** `VITE_API_URL` on Vercel → `https://api.yourdomain.com/api`; add the new frontend origin(s) to `CLIENT_URL` on Render. Redeploy both.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Storefront loads but **no products / network errors** | `VITE_API_URL` wrong, or missing `/api` suffix | Set `VITE_API_URL=https://<render>/api` on Vercel; redeploy |
| API calls blocked by **CORS** in the console | `CLIENT_URL` on Render doesn't include the exact Vercel origin | Add the exact origin (no trailing slash) to `CLIENT_URL`; redeploy |
| Admin **login fails only in Safari** | third-party cookie blocked | Use the Vercel proxy (Option 2 above) |
| `403 CSRF_BLOCKED` on legitimate admin actions | request `Origin` not in `CLIENT_URL` | Ensure `CLIENT_URL` lists the exact frontend origin serving the app |
| Render deploy **fails at build** on missing `prisma`/`tsc`/types | `NODE_ENV=production` made npm skip devDependencies, or `prisma generate` ran after `tsc` | Blueprint handles both (`npm install --include=dev`, then `prisma:generate` before `build`); keep that order if you customize it |
| Service **won't boot**, logs say a var is invalid | prod guard rejected a weak/default secret/password or `localhost` `CLIENT_URL` | Set strong non-default values; https origins only |
| `/api/health` returns **503** | DB unreachable | Check `DATABASE_URL` (direct string, `?sslmode=require`), Neon project not deleted |
| First request **very slow**, then fine | Render/Neon cold start (free tier) | Expected; upgrade Render to `starter` or ping `/api/health` periodically |

---

## Environment variable reference

**Backend (Render)** — see [`server/.env.production.example`](../server/.env.production.example):

| Var | Required | Notes |
|-----|:--------:|-------|
| `NODE_ENV` | ✅ | `production` — enables secure cookies, HSTS, boot guards |
| `PORT` | — | injected by Render; leave unset |
| `DATABASE_URL` | ✅ | Neon **direct** string, `?sslmode=require` |
| `CLIENT_URL` | ✅ | frontend origin(s), comma-separated, https, no trailing slash |
| `JWT_SECRET` | ✅ | ≥32 random chars (Blueprint auto-generates) |
| `JWT_EXPIRES_IN` | — | default `7d` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | ✅ | non-default password required in prod |
| `STAFF_EMAIL` / `STAFF_PASSWORD` | ✅ | non-default password required in prod |
| `LOG_LEVEL` | — | `debug\|info\|warn\|error` (default `info` in prod) |

**Frontend (Vercel)** — see [`client/.env.example`](../client/.env.example):

| Var | Required | Notes |
|-----|:--------:|-------|
| `VITE_API_URL` | ✅ (prod) | Render API base **incl. `/api`**; public (compiled into the bundle) |

> **Never** put `DATABASE_URL`, `JWT_SECRET`, or any password in a `VITE_*` var or
> anywhere in `client/` — those ship to the browser. Secrets live only on Render.
