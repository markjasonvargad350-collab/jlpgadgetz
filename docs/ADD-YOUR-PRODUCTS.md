# 📱 Add Your Real Products — JLP Gadgetz Center

A step-by-step guide for the shop owner. Everything here is done in the **admin
panel** in a browser — no code, no developer needed.

| | |
|---|---|
| **Store (customers)** | https://jlpgadgetz.vercel.app |
| **Admin panel (you)** | https://jlpgadgetz.vercel.app/admin/login |

> Only two things in this guide need a developer, and they're listed at the very
> bottom. Everything else you can do yourself.

---

## Contents

1. [Sign in](#1-sign-in)
2. [First-time setup: your 3 branches](#2-first-time-setup-your-3-branches)
3. [Add a brand-new phone](#3-add-a-brand-new-phone)
4. [Add a pre-owned / second-hand phone](#4-add-a-pre-owned--second-hand-phone)
5. [Turn on installments for a product](#5-turn-on-installments-for-a-product)
6. [Stock — how quantities work](#6-stock--how-quantities-work)
7. [Photos](#7-photos)
8. [Retire the sample (demo) products](#8-retire-the-sample-demo-products)
9. [Day-to-day: trade-ins & installments](#9-day-to-day-trade-ins--installments)
10. [What needs a developer](#10-what-needs-a-developer)
11. [Quick checklist](#quick-checklist)

---

## 1. Sign in

1. Open **https://jlpgadgetz.vercel.app/admin/login**
2. Enter your admin email and password → **Sign in**.

You land on the **Dashboard**. The left sidebar is your whole back-office:

| Menu | What it's for |
|---|---|
| **Dashboard** | Today's sales, low stock, recent orders |
| **Orders** | Online orders from customers |
| **Products** | Your catalogue — this is where you add phones |
| **Inventory** | Stock levels and the stock history |
| **Trade-ins** | Phones customers want to sell/trade to you |
| **Installments** | Monthly-payment applications and payments |
| **Branches** | Your Kalibo / Passi / Sara locations |
| **Reports** | Sales charts |

There are two kinds of staff login:

- **ADMIN** — can do everything (change stock, delete products, delete branches).
- **STAFF** — can do the day-to-day work but **cannot** adjust stock or delete
  things. Stock buttons simply won't appear for them.

---

## 2. First-time setup: your 3 branches

Do this once, before adding products. Branches are what customers pick as their
preferred/pickup shop on checkout, trade-in and installment forms.

1. Sidebar → **Branches** → **New branch**.
2. Fill in and **Create branch**. Repeat for all three.

Suggested values (only Passi has a street address on record — **leave the other
two blank** rather than guessing):

| Field | Passi | Kalibo | Sara |
|---|---|---|---|
| Branch name | `Passi Branch` | `Kalibo Branch` | `Sara Branch` |
| City / municipality | `Passi City` | `Kalibo` | `Sara` |
| Province | `Iloilo` | `Aklan` | `Iloilo` |
| Street address | `Dorillo Street, Passi City, Passi, Philippines, 5037` | *(leave blank)* | *(leave blank)* |
| Phone | `0930 119 7407` | `0930 119 7407` | `0930 119 7407` |
| Email | `jlpgadgetzcenter@gmail.com` | same | same |
| Display order | `1` | `2` | `3` |
| Visible to customers | ✅ | ✅ | ✅ |
| Main branch | ✅ | — | — |

Notes:

- **Street address** can stay empty — customers then just see the city and
  province. Fill it in later when you have the exact address.
- **Main branch** is the one pre-selected in customer forms. Only tick it once.
- **Visible to customers** unticked = the branch disappears from the store but
  keeps all its history. Use this instead of deleting.
- **Latitude / Longitude** are optional (for a map pin later). Enter **both** or
  **neither**.
- A branch that already has orders, trade-ins or installments **can't be
  deleted** — untick *Visible to customers* to hide it.

---

## 3. Add a brand-new phone

Sidebar → **Products** → **New product** (top right).

### Step 1 — Details

| Field | What to put | Notes |
|---|---|---|
| **Product name** | `iPhone 13` | What customers see |
| **Category** | `iPhone` | Pick the closest one (see [§10](#10-what-needs-a-developer)) |
| **Status** | `Draft` for now | Switch to **Active** when it's ready to sell |
| **Brand** | `Apple` | Change for other brands |
| **Model** | `iPhone 13` | Optional |
| **Base price (₱)** | `28000` | The "from" price shown on the card |
| **Discount %** | `0` | Shows a struck-through price if above 0 |
| **Release year** | `2021` | Optional |
| **Description** | A few honest sentences | Required |
| **Highlights** | One bullet per line | e.g. `A15 Bionic chip` |
| **Flags** | Featured / New arrival / Best seller / On deal | Controls where it appears on the homepage |
| **Installment** | See [§5](#5-turn-on-installments-for-a-product) | |

Press **Create product**. You're taken straight into the edit screen, where
**Images** and **Variants** are now available.

> Prices are in pesos. Type numbers only — no `₱`, no commas: `28000`, not
> `₱28,000`.

### Step 2 — Add at least one variant

A **variant** is one sellable combination — storage + colour + condition. Prices
and stock live on the variant, not the product.

In the **Variants** card → **Add variant**:

| Field | Example | Notes |
|---|---|---|
| **SKU** | `IP13-128-MID-NEW` | Your own code. Must be unique across the shop |
| **Price (₱)** | `28000` | What the customer actually pays |
| **Storage** | `128GB` | |
| **Color** | `Midnight` | |
| **Color hex** | `#1B1B1F` | Optional — draws the little colour dot |
| **Low-stock threshold** | `2` | Flags the variant as "Low" at or below this |
| **Opening stock** | `3` | How many you have right now |
| **Image URL** | *(optional)* | A photo for this exact colour |
| **Condition** | `Brand new` | See [§4](#4-add-a-pre-owned--second-hand-phone) |
| **Active — sellable** | on | Off = hidden from the store |

**Add variant**, then repeat for every storage/colour you stock.

### Step 3 — Publish

Back in **Details**, set **Status → Active — published** and press **Save
changes**. The phone is now live on the store.

---

## 4. Add a pre-owned / second-hand phone

Exactly the same as above, with the **Condition** box on the variant doing the
work. Options: **Brand new**, **Open box**, **Refurbished**, **Pre-owned**.

Pick anything other than *Brand new* and two extra fields appear:

- **Battery health %** — the figure from the phone's *Settings › Battery Health*
  (e.g. `87`). Optional but customers look for it.
- **Condition note** — up to 500 characters, **shown to customers**. Be honest:
  `Light scuff on the frame, screen flawless. Unit only — no box.`

Customers see the condition as a badge on the product card and the battery
health on the product page.

### The same phone, new *and* pre-owned

Condition is part of a variant's identity, so **`128GB · Midnight · Brand new`**
and **`128GB · Midnight · Pre-owned`** can both exist on the same product, at
different prices and with separate stock. Give them different SKUs
(`…-NEW` / `…-USED`) and you're done.

Two ways to organise pre-owned stock — either is fine:

1. **Same product, extra variants** — good when it's the same model, e.g. an
   iPhone 13 page with new *and* pre-owned units.
2. **A separate product** — good when the unit is one-of-a-kind. Name it
   plainly, e.g. `iPhone 11 (Pre-owned)`, and give it one variant with
   `Opening stock = 1`.

---

## 5. Turn on installments for a product

In **Details** → **Installment**:

1. Press the toggle so it reads **Installment allowed**.
2. Optionally set **Minimum down payment %** (0–90). `0` = no down payment
   required.
3. **Save changes**.

That product now appears on the store's **Installment** page, where the customer
picks a term of **3, 6, 9 or 12 months**.

**How the monthly amount is worked out — nothing else is added:**

```
principal = price − down payment
monthly   = principal ÷ number of months
```

No interest, no service fee, no financing charge. Example — ₱28,000 phone, 20%
down, 6 months:

```
down payment = ₱5,600      principal = ₱22,400      monthly = ₱3,733.33
```

The last month absorbs any centavo rounding, so the 6 monthly amounts add up to
exactly ₱22,400.

The store shows the figure for information only — the amounts are always
recalculated on the server from the price in your catalogue when the customer
applies, so a customer can't tamper with them.

Also worth knowing:

- The price is **frozen into the application** at the moment the customer
  applies. Re-pricing the product later never changes an existing plan.
- Applications arrive as **Pending**. Nothing is auto-approved — you approve
  every plan yourself (see [§9](#9-day-to-day-trade-ins--installments)).
- If no product has installments enabled, the Installment page tells customers
  to call or text you instead.

---

## 6. Stock — how quantities work

Stock is **one shared pool** for the whole business. It is not split per branch —
a branch is the customer's preferred pickup/contact shop, nothing more.

- **When creating a variant**, type the quantity in **Opening stock**.
- **After that**, stock can only be changed through the ledger: on the variant
  row press **Adjust** (ADMIN only). Pick what happened — *Restock — new stock
  arrived*, *Customer return*, *Cancelled order*, or *Correction (count /
  audit)* — and enter how many to add or remove. There's also a **Set to value**
  tab for after a physical stock-take. Every movement is recorded and visible
  under **Inventory**.
- The **Edit variant** form deliberately has no stock box — that's why.
- Online orders deduct stock automatically when the order is placed.

---

## 7. Photos

Photos are added **by URL** (there's no file upload yet):

1. Open the product → **Images** card.
2. Paste an **Image URL**, optionally add **Alt text** → **Add**.
3. The **first image is the cover** shown on the store. Delete with the ✕ on the
   thumbnail.

To get a URL for your own photos, upload them somewhere public first (your
Facebook page's photo link, Google Drive with public sharing, Imgur, Cloudinary,
etc.) and paste that link. Per-variant photos go in the variant's **Image URL**
box.

> ⚠️ Use **your own photos** of your own units, or a placeholder such as
> `https://placehold.co/800x800`. Don't paste Apple's official marketing images —
> they're copyrighted.

---

## 8. Retire the sample (demo) products

The store shipped with 15 sample items (10 iPhones plus a few accessories) so the
pages weren't empty. Once your real products are in:

1. **Products** → open a sample product.
2. Set **Status → Archived — hidden, kept for history** → **Save changes**.

Archived products vanish from the store but keep their history. **Delete** is
blocked for anything with stock or sales history (you'll see *"This product has
inventory or sales history and cannot be deleted. Archive it instead."*) — that's
the safety net protecting your records. Archiving is the right move.

---

## 9. Day-to-day: trade-ins & installments

Both are **applications**, not automatic transactions. The customer submits a
form online; you and your staff decide everything in the admin panel.

### Trade-ins (a customer selling/trading their phone to you)

Sidebar → **Trade-ins**. Each row is one device, with a reference like
`TRD-20260821-0001`. Open it and you'll see the device details the customer
typed, their contact number, and their preferred branch.

The workflow, one button at a time:

```
Submitted → Reviewing → Quoted → Accepted → Completed
                 ↘ Declined / Cancelled
```

- **You type the offer.** In the **Valuation** card enter the **Quoted value
  (₱)** (your offer) and later the **Final value (₱)** (what you actually
  paid/credited), plus **Internal notes** for your team. The app never
  calculates or guesses a price — pricing a used phone is your job, after
  inspecting it.
- The device details are the **customer's own description**. Always verify the
  unit in person before paying.
- Nothing is deleted. Declining or cancelling keeps the record.

#### Installments

Sidebar → **Installments**. References look like `INS-20260821-0001`.

```
Pending → Approved → Active → Completed
     ↘ Rejected / Cancelled
```

- **Approve plan** first — you can't record a payment on a pending application.
- The plan shows the full month-by-month schedule: month, due date, amount due,
  amount paid, and status. An unpaid month past its due date is flagged
  **Overdue**.
- To record a payment, press **Record** on that month's row, enter the amount,
  the method (Cash/COD, GCash, Bank transfer) and a reference number.
  **Partial payments are allowed** — the month settles once its full amount is
  in.
- You can't record more than what's still owed on that month.
- **Payments are only ever added, never deleted or overwritten.** When every
  month is paid the plan flips to **Completed** by itself.
- **Internal notes** on both trade-ins and installments are staff-only — the
  customer never sees them.

---

## 10. What needs a developer

Everything else in this guide you control. These two are in code:

1. **The category list** — currently *iPhone*, *AirPods*, *Chargers & Cables*,
   *Cases & Protection*. If you start selling Samsung, Xiaomi, laptops, etc.
   and want a proper category for them, that's a small code change. Until then,
   file them under the closest existing category — the product name and brand
   still show correctly.
2. **The installment terms** — fixed at 3, 6, 9 and 12 months, interest-free.
   Changing the available terms is a code change.

---

## Quick checklist

Setting the shop up for the first time:

- [ ] Sign in at `/admin/login`
- [ ] **Branches** — create Passi (main), Kalibo, Sara
- [ ] **Products** — add each real phone: Details → Create → Images → Variants
- [ ] Every variant has SKU, price, storage, color, **condition** and opening stock
- [ ] Pre-owned units have battery health + an honest condition note
- [ ] Installment toggle on for the phones you'll offer monthly
- [ ] Product **Status = Active** for everything ready to sell
- [ ] Archive the 15 sample products
- [ ] Open the store and check a product page, the Installment page and About

Then, day to day: **Orders** for online sales, **Trade-ins** for phones coming
in, **Installments** for approvals and payments, **Inventory** when stock moves.
