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
8. [Your catalogue and the old sample products](#8-your-catalogue-and-the-old-sample-products)
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
  things. Those buttons don't appear for them; where a stock button would be,
  they see a short note saying an ADMIN sign-in is needed.

Your own role is shown in the sidebar, under your name.

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
| **Base price (₱)** | `28000` | The cash "from" price shown on the card |
| **Discount %** | `0` | Shows a struck-through price if above 0 |
| **Release year** | `2021` | Optional |
| **Description** | A few honest sentences | Required |
| **Highlights** | One bullet per line | e.g. `A15 Bionic chip` |
| **Flags** | Featured / New arrival / Best seller / On deal / Pre-owned | Controls where it appears on the homepage. Leave *Pre-owned* off for brand-new stock |
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
| **Storage** | `128GB` | |
| **Color** | `Midnight` | Use `Assorted` if you don't sort your stock by colour |
| **Color hex** | `#1B1B1F` | Optional — draws the little colour dot |
| **Cash price (₱)** | `28000` | What a customer pays to buy it outright |
| **Installment base price (₱)** | `31000` | Optional. The higher price a monthly plan divides — leave blank to use the cash price |
| **Low-stock threshold** | `2` | Flags the variant as "Low" at or below this |
| **Opening stock** | `3` | How many you have right now |
| **Image URL** | *(optional)* | A photo for this exact colour |
| **Condition** | `Brand new` | See [§4](#4-add-a-pre-owned--second-hand-phone) |
| **Active — sellable** | on | Off = hidden from the store |

**Add variant**, then repeat for every storage/colour you stock.

> **The two prices.** *Cash price* is what checkout charges and what the store
> shows on the card and product page. *Installment base price* is the figure a
> monthly plan is divided from — normally a bit higher, because a plan is paid
> over time. Fill in both if you price them differently; leave the installment
> box empty and monthly plans simply use the cash price. Every option's two
> prices are shown side by side on the variant list, and the store never mixes
> them up: the cart always charges cash, the Installment page always quotes from
> the installment base ([§5](#5-turn-on-installments-for-a-product)).

### Step 3 — Publish

Back in **Details**, set **Status → Active — published** and press **Save
changes**. The phone is now live on the store.

---

## 4. Add a pre-owned / second-hand phone

There are **two separate switches**, and they do different jobs:

| | Where | What it does |
|---|---|---|
| **“Pre-owned” flag** | Product → **Details** → Flags | Labels the **whole listing** second-hand: a *Pre-owned* badge on the card and product page, a place in the homepage **Pre-owned** row, and inclusion in the store's *Pre-owned only* filter |
| **Condition box** | Product → **Variants** → each variant | The truth about **one specific unit**: Brand new / Standard / Open box / Refurbished / Pre-owned, plus battery health and a condition note |

Rule of thumb:

- Listing sells **only** second-hand units (e.g. `iPhone 11 (Pre-owned)`) → tick
  the **Pre-owned** flag *and* set each variant's condition.
- Listing sells brand-new *and* second-hand units on the same page → leave the
  **Pre-owned** flag **off** and let the per-variant condition speak. Ticking it
  would label the brand-new units second-hand too.

### The variant's Condition box

Options, best-first:

| Condition | Use it for |
|---|---|
| **Brand new** | Sealed, never opened |
| **Standard** | Your standard shelf unit — opened and tested by you, not sealed-new. This is the tier most of your price list sits in |
| **Open box** | Sealed unit that was opened but never really used |
| **Refurbished** | Repaired/reconditioned before resale |
| **Pre-owned** | Second-hand, previously used by someone else |

Pick anything other than *Brand new* and two extra fields appear:

- **Battery health %** — the figure from the phone's *Settings › Battery Health*
  (e.g. `87`). Optional but customers look for it.
- **Condition note** — up to 500 characters, **shown to customers**. Be honest:
  `Light scuff on the frame, screen flawless. Unit only — no box.`

Customers see the condition as a badge on the product card and the battery
health on the product page.

> *Standard* is your own grading, so it appears in the admin form and on the
> store — but **not** on the customer's trade-in form. Someone describing their
> own phone can't claim a tier that means "JLP has tested this unit".

### The same phone, new *and* pre-owned

Condition is part of a variant's identity, so **`128GB · Standard`** and
**`128GB · Brand new`** can both exist on the same product, at different prices
and with separate stock. That's exactly how your catalogue is already set up —
e.g. the iPhone 14 page carries `IP14-128-STD` at ₱24,990 and `IP14-128-NEW` at
₱33,990, and the customer picks between them. Ending the SKU with the condition
(`…-STD`, `…-NEW`, `…-PRE`) keeps them easy to tell apart.

Two ways to organise pre-owned stock — either is fine:

1. **Same product, extra variants** — good when it's the same model, e.g. an
   iPhone 14 page with standard *and* brand-new units.
2. **A separate product** — good when the unit is one-of-a-kind. Name it
   plainly, e.g. `iPhone 11 (Pre-owned)`, and give it one variant with
   `Opening stock = 1`.

---

## 5. Turn on installments for a product

In **Details** → **Installment**:

1. Press the toggle so it reads **Installment allowed**.
2. Optionally set **Minimum down payment %** (0–90) — a percentage of the
   installment base price. `0` = no down payment required. Your catalogue is set
   to `20` on every phone.
3. **Save changes**.

That product now appears on the store's **Installment** page, where the customer
picks a term of **3, 6, 9 or 12 months**.

**How the monthly amount is worked out — nothing else is added:**

```
principal = installment base price − down payment
monthly   = principal ÷ number of months
```

The figure divided is the variant's **installment base price**, not its cash
price (see [§3](#step-2--add-at-least-one-variant)). If a variant has no
installment price of its own, its cash price is used instead.

No interest, no service fee, no financing charge. Example — a Standard iPhone 14
at ₱24,990 cash / **₱27,990 installment**, 20% down, 6 months:

```
down payment = ₱5,598      principal = ₱22,392      monthly = ₱3,732
```

The last month absorbs any centavo rounding, so the 6 monthly amounts add up to
exactly ₱22,392.

The store shows the figure for information only — the amounts are always
recalculated on the server from the price in your catalogue when the customer
applies, so a customer can't tamper with them.

Also worth knowing:

- The installment base price is **frozen into the application** at the moment the
  customer applies. Re-pricing the product later never changes an existing plan.
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

> **No "Adjust" button?** Then you're signed in as **STAFF** — check the role
> under your name in the sidebar. Stock can only be moved by an ADMIN, and no
> screen in the back office can hand out that role, so it has to be granted from
> outside the app. Ask your developer to run `npm run admin:doctor`, which lists
> every account and says which of them can change stock (see
> [DEPLOYMENT.md → Going live: clean slate](DEPLOYMENT.md#going-live-clean-slate)).

**Counting the whole shop at once.** The products loaded from your price sheet start
with a **placeholder** quantity (1 for each pre-owned unit, 3 for each standard /
brand new one), because a price list doesn't say how many you have. Setting them one
by one is a lot of clicking, so there's a spreadsheet shortcut:
`stock-worksheet.csv` in the project folder lists every variant with its price and
its current count, and one empty column — **REAL_QTY**. Write your real number in
each row you've counted, use **0** where you have none left, leave a row **blank** to
come back to it later, and send the file to your developer to run
`npm run stock:set`. Each count lands in the ledger as a *Correction* exactly as if
you'd typed it into **Adjust**, so **Inventory → Transactions** still shows the full
history.

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

## 8. Your catalogue and the old sample products

Your real price list — **26 listings / 48 sellable options** across *Pre-owned*,
*Standard* and *Brand new* — is already loaded, so there are no sample phones
left to clean up:

- The 8 sample iPhones that matched a model you actually sell were **rewritten**
  into the real thing: same page, real prices, real condition tiers.
- The 3 with no counterpart (iPhone 13 mini, iPhone SE 3rd gen and the demo
  *iPhone 12 (Pre-loved)* listing) are already **Archived** — gone from the
  store, history intact.
- Leftover demo options on the rewritten pages are set to **Inactive** with 0
  stock. They stay in the Variants card so old orders still make sense; just
  ignore them.
- **Your accessories were not touched** — AirPods Pro 2, AirPods 3, the 20W
  adapter, the MagSafe charger and the silicone case keep their prices, stock,
  variants and photos exactly as they were.

Two things to finish yourself:

1. **iPhone 11 Pro is a Draft.** Your price list had no figure for it, so it was
   created unpublished with a ₱0 inactive option — nothing a customer can see.
   Type the real cash and installment prices on the variant, tick **Active —
   sellable**, then set **Status → Active** in Details.
2. **Check every quantity.** Opening stock was a placeholder: **1** for
   pre-owned units, **3** for standard and brand-new ones. Fix them from
   **Inventory** or the **Adjust** button on each variant row — the *Set to
   value* tab is the quickest after a stock-take.

To hide any listing later: **Status → Archived — hidden, kept for history** →
**Save changes**. Archived products vanish from the store but keep their history.
**Delete** is blocked for anything with stock or sales history (you'll see *"This
product has inventory or sales history and cannot be deleted. Archive it
instead."*) — that's the safety net protecting your records. Archiving is the
right move.

> **If a developer ever re-loads the catalogue.** Those 26 listings also exist in
> code (`server/prisma/catalog-defs.ts`), and re-running `npm run catalog:sync`
> resets their names, descriptions, flags and **both prices** back to that file.
> It never touches stock, photos or your accessories, and it never deletes
> anything. So if you change a price here in admin, tell them to update that file
> too — otherwise the next run puts the old price back.

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

Everything else in this guide you control. These are in code:

1. **The category list** — currently *iPhone*, *iPad*, *AirPods*, *Chargers &
   Cables*, *Cases & Protection*. If you start selling Samsung, Xiaomi, laptops,
   etc. and want a proper category for them, that's a small code change. Until
   then, file them under the closest existing category — the product name and
   brand still show correctly.
2. **The installment terms** — fixed at 3, 6, 9 and 12 months, interest-free.
   Changing the available terms is a code change.
3. **Who is an ADMIN** — granting the role that can change stock (see [§6](#6-stock--how-quantities-work)).
4. **Loading a whole stock-take at once** from `stock-worksheet.csv`
   (`npm run stock:set`, see [§6](#6-stock--how-quantities-work)). Counting in the
   back office one variant at a time needs no developer.
5. **Clearing the test orders** before you open for real. There's no button for
   this — orders are permanent records on purpose. A developer runs
   `npm run reset:transactions`, which deletes the practice orders and their
   payments/shipments but **keeps your stock counts**, leaving one *"Opening
   balance"* line per option in the Inventory history. Prices, photos,
   accessories, branches and logins are untouched. Do it **after** you've set the
   real quantities, not before.

---

## Quick checklist

Setting the shop up for the first time — your price list is already loaded, so
this is mostly checking and finishing:

- [ ] Sign in at `/admin/login`
- [ ] **Branches** — create Passi (main), Kalibo, Sara
- [ ] **Inventory** — correct the placeholder quantities (1 pre-owned / 3 standard
      and new) on every option
- [ ] **iPhone 11 Pro** — type its two prices, tick the variant *Active*, set
      Status → Active ([§8](#8-your-catalogue-and-the-old-sample-products))
- [ ] **Photos** — swap the placeholder images for your own ([§7](#7-photos))
- [ ] Check the storage labels and colours match what you really stock (colours
      are all `Assorted` until you split them)
- [ ] Adding something new? Details → Create → Images → Variants — every variant
      needs a SKU, **cash price**, storage, colour, **condition** and opening
      stock, plus the **installment base price** if it differs
- [ ] Pre-owned units have battery health + an honest condition note
- [ ] Second-hand-only listings have the **Pre-owned** flag ticked in Details
- [ ] Installments are already on for all 26 listings at 20% minimum down — change
      any you don't want to offer monthly
- [ ] Product **Status = Active** for everything ready to sell
- [ ] Open the store and check a product page, the Installment page and About

Then, day to day: **Orders** for online sales, **Trade-ins** for phones coming
in, **Installments** for approvals and payments, **Inventory** when stock moves.
