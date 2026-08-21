# 🍊 iStore — Full-Stack iPhone E-Commerce & Inventory System

A production-minded, **Shopee-meets-Apple** online iPhone store with a secure admin inventory/order back-office. Customers buy as **guests (no account needed)**; only administrators authenticate.

Design language: **"Sunset Glass"** — a warm orange→white gradient, frosted glassmorphism, and luxurious motion.

> **Status:** 🟢 Phases 1–11 complete — the full **customer storefront** (home, catalog with live search/filter/sort/pagination, product detail with variant selection, cart, and Buy Now) plus **guest checkout** now work end to end against real Neon data on the **Sunset Glass** design system, verified across desktop and mobile. Orders are created inside a **single DB transaction** that re-validates stock, re-derives every price server-side, and writes the inventory ledger atomically; the browser sends only variant IDs + quantities. Out-of-stock races surface as a `409` with a one-click "adjust and retry" fix, and a **no-account, email-verified order lookup** confirms each order. The **inventory admin API** now backs the back-office: a variant-centric stock list (in/low/out filters, sort, search), dashboard stats, a filterable transaction ledger, and an ADMIN-only manual-adjust endpoint — with **overselling protection proven concurrency-safe** (a guarded atomic decrement; two concurrent last-unit orders yield exactly one `201` and one `409`). The **admin back-office** is now live: a glass sidebar + top-bar shell behind HTTP-only-cookie auth (ADMIN/STAFF roles), a dashboard (inventory KPIs, a 30-day revenue area chart, recent orders, low-stock alerts), product & variant management, the inventory stock console, an **orders fulfillment state-machine** (single-step-forward transitions with a compare-and-set race guard, and ADMIN-only cancellation that restocks through the ledger and simulates a refund), and a **reports** view (sales KPIs, revenue trend, status/payment breakdowns, top products) — all in Philippine peso and Asia/Manila time, verified in-browser. Finally, **delivery** is live (simulated, swappable): every order gets a `Shipment` at checkout, the fulfillment state-machine drives its geo, and the **Track Order page** is a no-account tracking hub with a **simulated Leaflet map** — keyless CARTO tiles, a solid/dashed route, and an **animated courier marker** (with a `prefers-reduced-motion` fallback), all explicitly labelled *not live GPS* — while admins edit courier/tracking/ETA and the whole back-office is **code-split** out of the storefront bundle (~933 kB → ~484 kB entry). Finally, the app is **production-hardened** (runtime pass; tests/CI intentionally deferred): cookie-authed admin mutations sit behind an **Origin/Referer CSRF allowlist** (`403 CSRF_BLOCKED`) with multi-origin CORS, a prod boot **refuses** a weak/default `JWT_SECRET` or the default admin/staff passwords, and Helmet ships HSTS + a locked-down referrer policy; the API gains **gzip compression**, a per-request `X-Request-Id` with one structured log line per call, and `Cache-Control` (cacheable public catalog GETs, `no-store` on everything authed); the client gains an **error boundary** (no more white-screen throws), a fixed product-fetch error path, surfaced category-load failures, and a session probe that tells *signed-out* from *server-unavailable*; **accessibility** adds a reusable focus-trap (modals + drawers), keyboard-operable table rows, `role="alert"` error regions wired to their fields, skip-links, focus rings, visible labels, and per-route document titles; and **performance/polish** adds a global `prefers-reduced-motion` config, six catalog/inventory DB indexes, `select`-scoped product queries, lazy below-fold images, and a single shared easing token + reused payment badge — all verified via `curl`, authenticated API, and in-browser. Finally, **deployment is documented and codified**: a **Render Blueprint** (`render.yaml`) for the API, a **Vercel** SPA config (`client/vercel.json`), a production env checklist, and a step-by-step **[deployment runbook](docs/DEPLOYMENT.md)** (Vercel + Render + Neon) covering CORS/CSRF `CLIENT_URL` wiring across the two origins, the cross-origin **cookie caveat** + a same-origin proxy alternative, one-time production seeding, and a post-deploy verification checklist — with **no secrets in the repo and none in the frontend bundle**. 🎉 **All 11 phases complete — the app is production-hardened and deploy-ready.** See [Build Phases](#build-phases).

---

## Tech Stack

| Layer     | Tech |
|-----------|------|
| Frontend  | React 19 · Vite 8 · TypeScript · Tailwind CSS v4 · React Router · Axios · Lucide · Recharts · Framer Motion · React-Leaflet |
| Backend   | Node · Express 5 · TypeScript · REST · Zod · JWT · bcryptjs · Helmet · rate-limit |
| Database  | PostgreSQL · Prisma 7 ORM |

## Project Structure

```
IphoneEcommerce/
├── client/          # React + Vite frontend (Sunset Glass storefront + admin)
│   └── src/         # components, pages, layouts, services, hooks, contexts, routes, types, utils
├── server/          # Express + TypeScript API
│   ├── prisma/      # schema + migrations + seed
│   └── src/         # config, middleware, routes, controllers, services, validators, utils
├── package.json     # root: run both apps with one command
└── README.md
```

## Prerequisites

- **Node.js ≥ 20** (developed on v24)
- A **PostgreSQL** database. No local install needed — use a free managed option:
  - **Neon** → https://neon.tech (recommended)
  - **Supabase** → https://supabase.com

## Setup

```bash
# 1) Install dependencies for root + both apps
npm run install:all

# 2) Configure the backend environment
cp server/.env.example server/.env
#   → paste your Neon/Supabase connection string into DATABASE_URL
#   → set a strong JWT_SECRET

# 3) (Phase 2+) Create the database schema and seed data
npm --prefix server run prisma:migrate      # creates tables
npm --prefix server run seed                # loads iPhones, admin, sample orders

# 4) (optional) Frontend env — only needed if not using the dev proxy
cp client/.env.example client/.env
```

## Running (development)

```bash
# Run BOTH apps together (from the repo root)
npm run dev
```

Or individually:

```bash
npm run dev:client     # http://localhost:5173  (Vite)
npm run dev:server     # http://localhost:4000  (Express API, /api/health)
```

The Vite dev server proxies `/api/*` to the backend, so there are no CORS issues locally.

## Useful Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Run client + server together |
| `npm run build` | Production build of both apps |
| `npm --prefix server run prisma:studio` | Visual DB browser |
| `npm --prefix server run typecheck` | Type-check the backend |

## Security Notes

- Passwords hashed with **bcryptjs**; admin sessions use **HTTP-only cookies** + JWT.
- Input validated with **Zod**; **Helmet**, **CORS** (credentials), and **rate limiting** enabled.
- Secrets live only in `server/.env` (git-ignored). Never commit `.env`; never put payment/API secrets in the frontend.
- **Known dev-only advisory:** the Prisma 7 CLI depends transitively on `deepmerge-ts` (a recursive-merge DoS advisory). It affects only build/dev tooling that parses config — **not** the runtime API — so we keep Prisma 7 rather than force-downgrading to v6. It resolves upstream when Prisma bumps the dependency.

## Payments & Delivery (simulated, swappable)

- **Payments:** Cash on Delivery, GCash, Bank Transfer — simulated behind a `PaymentProvider` interface so a real gateway can be added server-side later without changing the order system.
- **Delivery:** a **simulated** Leaflet/OpenStreetMap tracking map (warehouse → distribution → in transit → out for delivery → delivered). Clearly labelled as simulated; architected so a real courier API can replace it.

## Build Phases

1. ✅ **Project init** — scaffolding, TypeScript, Tailwind/design system, Prisma, env, health check
2. ✅ **Database** — Prisma 7 schema, migration (`init`), seed (admin + 4 categories, 15 products / 85 variants, sample orders + shipments + tracking); ledger & order-total invariants verified
3. ✅ **Backend foundation** — Express middleware chain, centralized errors, Zod `validate`, JWT **HTTP-only cookie** auth + **bcrypt** (timing-safe), `requireAuth`/`requireRole`, admin auth routes (login/logout/me), DB-ping health check. Integration-tested: 200/401/422/429 + cookie lifecycle.
4. ✅ **Product system** — public catalog APIs (`GET /api/products` with search/filter/sort/pagination, `GET /api/products/:idOrSlug`, `GET /api/categories`) + admin product/variant/image CRUD with a transaction-safe inventory ledger (stock only moves via `InventoryTransaction`); client `services/` layer wired + live featured strip verified end to end.
5. ✅ **Customer store** — storefront shell (aurora background, sticky glass nav, footer) + home (hero, trust strip, live category tiles, featured/best-seller/new/deals rails), catalog with URL-synced search / category / price / in-stock filters, sort, and pagination, product detail with storage + colour variant selection and live stock, cart (localStorage-persisted, qty stepper, remove) and Buy Now. Verified end to end against Neon on desktop + mobile.
6. ✅ **Checkout** — guest checkout (no account): a validated address/contact form (client rules mirror the server's Zod schema), a transactional `POST /api/orders` that re-validates live stock, re-derives all money server-side, and creates the order + inventory ledger entries atomically (overselling → `409` with an inline "adjust to available & retry" fix), simulated COD/GCash/Bank-transfer payment instructions, and an animated confirmation screen with an **email-verified, no-account order lookup**. Verified end to end against Neon (happy path, stock conflict, validation, and lookup).
7. ✅ **Inventory admin (API)** — concurrency-safe inventory back-office: a variant-centric stock list (search, in/low/out status filters via DB-side field references, sort, pagination), dashboard stats (in/low/out counts, total units, `SUM(stock×price)` stock value), a filterable inventory ledger, and a validated **ADMIN-only** manual-adjust endpoint (`POST /api/admin/inventory/adjust`) supporting signed **delta** moves (restock/return/cancellation/adjustment) and absolute **set** with compare-and-set. Overselling is prevented by a guarded **atomic relative decrement** — a racing last-unit sale matches 0 rows → `409`, proven with two concurrent orders (exactly one `201`, one `409`, a single SALE row, final stock 0/OUT); stock still only ever moves through the `InventoryTransaction` ledger. Verified via authenticated API (401/403/422/404, filters, stats invariant, ledger, and the oversell race).
8. ✅ **Admin back-office** — a secure `/admin` shell (glass sidebar + slim top bar) behind **HTTP-only-cookie** auth hydrated via `GET /auth/me`, a `RequireAuth` guard, and role-aware controls (**ADMIN** vs **STAFF**). Dashboard with inventory KPI tiles, a **30-day revenue area chart** (Recharts), recent orders, and low-stock alerts; product & variant management (searchable/filterable `DataTable`, product editor with images + variants, stock-adjust modal writing the ledger); a variant-centric **inventory console** (in/low/out filters + adjust modal); an **orders fulfillment state-machine** — validated single-step-forward transitions (illegal jumps → `422`), a **compare-and-set guard** against concurrent-PATCH races (loser → `409`), and **ADMIN-only cancellation** that restocks every line through the `InventoryTransaction` ledger, floors `soldQty`, and simulates a refund on paid orders; and a **reports** view (`GET /api/admin/reports/summary`) — today/7-/30-day/all-time sales KPIs, average order value, collected revenue, order-status breakdown, payment mix, a 30-day daily-revenue series, and top products by units — rendered as KPI tiles, the shared area chart, and breakdown bars. All money in **PHP** and dates in **Asia/Manila** (fixed +08:00, no DST). Verified via authenticated API + in-browser after each sub-phase.
9. ✅ **Delivery** — a **simulated** end-to-end tracking system behind a swappable `DeliveryProvider` (mirroring `PaymentProvider`). Every order — seeded or freshly placed — now gets a `Shipment` created **inside the checkout transaction** (origin/destination/current coordinates, courier, an `IEX…` tracking code, a 72h ETA, and an initial RECEIVED history row); destinations come from a curated Metro-Manila centroid table (a documented simulation, **not geocoding**). The order DTO surfaces the geo (origin/destination/current + the 7-waypoint route + per-history `lat/lng`), and the **fulfillment state-machine now drives the shipment**: advancing a step moves `current` to that milestone, maps `OrderStatus → ShipmentStatus`, stamps `deliveredAt` on DELIVERED, and marks a cancellation FAILED — all **downstream of the compare-and-set, inside the same transaction** (a `409` loser touches nothing). The customer **Track Order page is the hub**: an order# + email lookup (keeping the guest **email guard**) renders a **simulated Leaflet map** — keyless CARTO Positron tiles, custom `divIcon`s (so no marker-asset 404), a solid *travelled* / dashed *remaining* route split, and an **animated courier marker** eased along the route via `requestAnimationFrame` with a `prefers-reduced-motion` static fallback — plus the full fulfillment timeline and shipment facts, with visibility-gated ~20s polling. Everything is explicitly labelled **"Simulated movement · not live GPS."** The confirmation screen gains a compact timeline + a "Track delivery" deep-link; the admin order detail shows the map read-only plus an **ADMIN-only** panel to edit courier / tracking code / ETA (`PATCH /api/admin/shipments/:orderNumber`; STAFF → `403`). The **admin back-office is now code-split** behind `React.lazy` — Recharts, Leaflet, and the admin shell all leave the storefront entry chunk (~933 kB → ~484 kB) and load only when someone visits `/admin` or a tracking view. Verified via authenticated API (shipment-on-checkout, state-machine geo sync, DELIVERED/cancel, ADMIN vs STAFF `403`, empty-body `422`) + in-browser (customer + admin maps, reduced-motion fallback, the deep-link, and a clean console with no tile/icon 404s).
10. ✅ **Production hardening** — a runtime security / API / UI / performance pass (automated tests & CI intentionally deferred). **Security:** an **Origin/Referer CSRF allowlist** (`403 CSRF_BLOCKED`) on every cookie-authed mutation, multi-origin **CORS** from a shared allowlist, boot-time **env guards** that reject a `<32`-char or default `JWT_SECRET`, the default admin/staff passwords, and `localhost` client URLs in production, tuned **Helmet** (prod HSTS, `no-referrer`, cross-origin resource policy), process-level `unhandledRejection`/`uncaughtException` + graceful-shutdown timeout + `EADDRINUSE` handling, and error-handler polish (`headersSent` guard, no leaked `P2002` column, 1 MB body cap, `env` dropped from `/api/health`). **API & observability:** `compression`, a per-request **`X-Request-Id`** (honoring inbound ids) with one `method path status durationMs id` log line per call, a leveled logger (`debug` + meta), and **`Cache-Control`** (public catalog GETs `public, max-age=60, stale-while-revalidate`; all admin/order/auth `no-store`). **Frontend resilience:** a hand-rolled **`ErrorBoundary`** (Sunset Glass fallback) around the app and each layout `<main>`, a fixed **ProductPage** error path (real failures no longer masquerade as "not found"), surfaced category-load errors, and a session probe that distinguishes `401` from server-unavailable. **Accessibility:** a shared **`useFocusTrap`** (modals, confirm dialog, stock-adjust, admin drawer — focus in / trap / restore + `aria-modal`/Escape), keyboard-operable **`DataTable`** rows, `role="alert"` error regions linked to inputs via `aria-describedby`, **skip-to-content** links + `focus-visible` rings, visible labels + landmarks, and per-route **`document.title`s**. **Performance & polish:** a global `<MotionConfig reducedMotion="user">`, **six** new catalog/inventory DB indexes (scale-readiness at current seed volume), `select`-scoped product queries (no relation over-fetch), lazy `decoding="async"` below-fold images (hero stays eager), and a single shared **`SPRING_EASE`** token + reused **`PaymentStatusBadge`**. Verified via `curl` (negative CSRF + prod-boot refusal), authenticated API (request-id, gzip, cache-control), and in-browser (error boundary, focus trap, keyboard rows, per-route titles, reduced motion).
11. ✅ **Deployment** — the app is **deploy-ready** on a free, production-grade stack (**Vercel** static SPA + **Render** Express API + **Neon** Postgres), codified as infrastructure-as-code. A **Render Blueprint** ([`render.yaml`](render.yaml), `rootDir: server`, `prisma generate`→`tsc` build, `migrate deploy`→`start`, `/api/health` health check, auto-generated `JWT_SECRET`, secrets as `sync:false`), a **Vercel** SPA config ([`client/vercel.json`](client/vercel.json) — Vite preset + client-side-routing fallback), a production **env checklist** ([`server/.env.production.example`](server/.env.production.example)) and a corrected [`client/.env.example`](client/.env.example) `VITE_API_URL` reference (the required `/api` suffix), and a full **[deployment runbook](docs/DEPLOYMENT.md)** — Neon → Render → Vercel step-by-step, CORS/CSRF `CLIENT_URL` wiring across the two origins, the third-party-**cookie caveat** with a same-origin Vercel-proxy alternative, a one-time production **seed** that inherits the strong prod passwords, redeploy/rollback/migration guidance, free-tier cold-start notes, custom-domain steps, a troubleshooting matrix, and a post-deploy **verification checklist** (health, guest order, admin login, gzip/cache/`X-Request-Id` headers, negative-CSRF `curl`). Per the project's security rules: **no secrets in the repo, none in the frontend bundle, default admin/staff passwords refused in production.** *(Scoped to config + docs — no live infrastructure was provisioned.)*

## Deployment

The app is **deploy-ready** on **Vercel** (frontend) + **Render** (API) + **Neon** (Postgres). Full step-by-step instructions — accounts, environment variables, CORS/cookie wiring, one-time seeding, and a post-deploy checklist — are in **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

Config-as-code lives in [`render.yaml`](render.yaml) (Render Blueprint for the API), [`client/vercel.json`](client/vercel.json) (Vercel SPA + Vite preset), and [`server/.env.production.example`](server/.env.production.example) (production env checklist). Set `VITE_API_URL` (Vercel) to the Render API base **including `/api`**, and `CLIENT_URL` (Render) to the Vercel origin(s) — that pair wires the two together for CORS + CSRF. **No secrets belong in the repo or the frontend bundle.**

## For the shop owner

Adding real products (new and pre-owned), setting up the three branches, turning on installments, and running the trade-in / installment queues are all done in the admin panel — no code. The walkthrough is in **[docs/ADD-YOUR-PRODUCTS.md](docs/ADD-YOUR-PRODUCTS.md)**.
