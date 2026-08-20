# 🍊 iStore — Full-Stack iPhone E-Commerce & Inventory System

A production-minded, **Shopee-meets-Apple** online iPhone store with a secure admin inventory/order back-office. Customers buy as **guests (no account needed)**; only administrators authenticate.

Design language: **"Sunset Glass"** — a warm orange→white gradient, frosted glassmorphism, and luxurious motion.

> **Status:** 🟢 Phases 1–8 complete — the full **customer storefront** (home, catalog with live search/filter/sort/pagination, product detail with variant selection, cart, and Buy Now) plus **guest checkout** now work end to end against real Neon data on the **Sunset Glass** design system, verified across desktop and mobile. Orders are created inside a **single DB transaction** that re-validates stock, re-derives every price server-side, and writes the inventory ledger atomically; the browser sends only variant IDs + quantities. Out-of-stock races surface as a `409` with a one-click "adjust and retry" fix, and a **no-account, email-verified order lookup** confirms each order. The **inventory admin API** now backs the back-office: a variant-centric stock list (in/low/out filters, sort, search), dashboard stats, a filterable transaction ledger, and an ADMIN-only manual-adjust endpoint — with **overselling protection proven concurrency-safe** (a guarded atomic decrement; two concurrent last-unit orders yield exactly one `201` and one `409`). The **admin back-office** is now live: a glass sidebar + top-bar shell behind HTTP-only-cookie auth (ADMIN/STAFF roles), a dashboard (inventory KPIs, a 30-day revenue area chart, recent orders, low-stock alerts), product & variant management, the inventory stock console, an **orders fulfillment state-machine** (single-step-forward transitions with a compare-and-set race guard, and ADMIN-only cancellation that restocks through the ledger and simulates a refund), and a **reports** view (sales KPIs, revenue trend, status/payment breakdowns, top products) — all in Philippine peso and Asia/Manila time, verified in-browser. 🟡 Phase 9 (delivery — shipments, tracking history, simulated map) next. See [Build Phases](#build-phases).

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
9. ⬜ Delivery — shipments, tracking history, simulated map
10. ⬜ Production hardening — security/API/UI/perf audits
11. ⬜ Deployment — Vercel + Render/Railway + managed Postgres

## Deployment

Detailed instructions are added in Phase 11 (frontend → Vercel, backend → Render/Railway, database → managed Postgres).
