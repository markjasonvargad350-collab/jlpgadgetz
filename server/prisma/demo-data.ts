/* eslint-disable no-console */
// ============================================================================
//  Demo data — ADDITIVE and IDEMPOTENT. Safe to run against the LIVE database.
//
//  `prisma/seed.ts` is destructive (it wipes every table, users included) and
//  refuses to run with NODE_ENV=production, so it can never be used to fill in
//  presentation data on a database that's already serving customers. This script
//  is the other half: it only ever ADDS what is missing.
//
//  What it does — all definitions come from ./demo-defs, shared with the seed:
//    1. Branches      — creates any of the 3 JLP branches that don't exist yet.
//    2. Installments  — turns the opt-in ON for the products in the shared table.
//    3. Pre-owned     — adds the "iPhone 12 (Pre-owned)" listing + its variants.
//    4. Applications  — adds the demo trade-in / installment applications.
//
//  What it will NEVER do:
//    • delete or wipe anything, ever
//    • change a product's price, name, description, or images
//    • touch existing stock levels, orders, payments, or users
//    • create a duplicate on a re-run (every step checks first, then skips)
//
//  Installment money is not hand-written: it runs through `computeSchedule`, the
//  same function the API uses at apply time (monthly = principal ÷ term, no
//  interest or fees, final row absorbs the rounding remainder).
//
//  Run against a local database:
//      npm --prefix server run demo:data
//
//  Run against the live database (paste your own connection string; it is a
//  secret — don't commit it or share it):
//      DATABASE_URL="<live-connection-string>" npm --prefix server run demo:data
// ============================================================================
import { Prisma, ProductStatus, ProductCondition, PaymentMethod, InventoryTxnType } from '@prisma/client';
import { prisma, disconnectPrisma } from '../src/config/prisma';
import { money } from '../src/utils/money';
import { computeSchedule } from '../src/config/installment';
import { dailyReferencePrefix, nextReferenceFrom } from '../src/utils/reference';
import {
  img,
  skuFor,
  BRANCH_DEFS,
  INSTALLMENT_MIN_DOWN_PCT,
  PRE_LOVED_DEMO,
  PRE_LOVED_STOCK,
  TRADE_IN_DEMOS,
  INSTALLMENT_DEMOS,
} from './demo-defs';

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

/** Mirrors `addMonths` in installment.service.ts — day clamped to month length. */
const addMonths = (date: Date, n: number) => {
  const d = new Date(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
};

/**
 * Next `KIND-YYYYMMDD-####` reference for the given (possibly backdated) day,
 * derived from the highest one already in the database for that day — so a demo
 * row can never take a reference a real application already owns.
 */
async function nextReference(kind: 'TRD' | 'INS', on: Date): Promise<string> {
  const prefix = dailyReferencePrefix(kind, on);
  const last =
    kind === 'TRD'
      ? await prisma.tradeIn.findFirst({
          where: { reference: { startsWith: prefix } },
          orderBy: { reference: 'desc' },
          select: { reference: true },
        })
      : await prisma.installmentPlan.findFirst({
          where: { reference: { startsWith: prefix } },
          orderBy: { reference: 'desc' },
          select: { reference: true },
        });
  return nextReferenceFrom(prefix, last?.reference ?? null);
}

async function main() {
  console.log('\n📦 Adding demo/presentation data (additive — nothing is deleted)\n');

  // Provenance for staff-recorded demo rows. Optional everywhere it's used, so a
  // database with no admin user yet still works.
  const admin = await prisma.user.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true },
  });
  console.log(admin ? `   ℹ Attributing staff actions to ${admin.email}` : '   ℹ No admin user found — staff provenance left blank');

  // --- 1. Branches ----------------------------------------------------------
  // Created only when the slug is missing: if the owner has already edited a
  // branch's address, hours, or phone in the admin panel, we leave it alone.
  const branches = new Map<string, string>();
  let branchesCreated = 0;
  for (const b of BRANCH_DEFS) {
    const existing = await prisma.branch.findUnique({ where: { slug: b.slug }, select: { id: true } });
    if (existing) {
      branches.set(b.slug, existing.id);
      console.log(`   • Branch ${b.slug} already exists — left untouched`);
      continue;
    }
    const created = await prisma.branch.create({ data: b });
    branches.set(b.slug, created.id);
    branchesCreated++;
    console.log(`   ✓ Branch created: ${b.name}`);
  }

  // --- 2. Installment opt-in on existing products ---------------------------
  // Only the two installment columns are written. Prices, names, descriptions,
  // images, and variants are never touched.
  let installmentEnabled = 0;
  for (const [slug, minDownPct] of Object.entries(INSTALLMENT_MIN_DOWN_PCT)) {
    // The pre-owned demo listing is step 3's job — it's created with these same
    // flags already set, so don't report it as a missing product here.
    if (slug === PRE_LOVED_DEMO.slug) continue;
    const product = await prisma.product.findUnique({
      where: { slug },
      select: { id: true, name: true, installmentAvailable: true, installmentMinDownPct: true },
    });
    if (!product) {
      console.log(`   • No product with slug "${slug}" — skipped (it may have been renamed or removed)`);
      continue;
    }
    if (product.installmentAvailable && product.installmentMinDownPct === minDownPct) {
      console.log(`   • ${product.name} already accepts installments — left untouched`);
      continue;
    }
    await prisma.product.update({
      where: { id: product.id },
      data: { installmentAvailable: true, installmentMinDownPct: minDownPct },
    });
    installmentEnabled++;
    console.log(`   ✓ Installments enabled: ${product.name} (min down ${minDownPct}%)`);
  }

  // --- 3. Pre-owned demo listing -------------------------------------------
  const def = PRE_LOVED_DEMO;
  let product = await prisma.product.findUnique({
    where: { slug: def.slug },
    select: { id: true, name: true, isPreOwned: true, installmentAvailable: true, installmentMinDownPct: true },
  });

  if (product) {
    // Present already: only make sure the two flags this demo is meant to show
    // are on. Price/description/images stay as the owner left them.
    const minDownPct = INSTALLMENT_MIN_DOWN_PCT[def.slug] ?? 0;
    const needsFlags =
      !product.isPreOwned || !product.installmentAvailable || product.installmentMinDownPct !== minDownPct;
    if (needsFlags) {
      await prisma.product.update({
        where: { id: product.id },
        data: { isPreOwned: true, installmentAvailable: true, installmentMinDownPct: minDownPct },
      });
      console.log(`   ✓ ${product.name} already existed — flags refreshed (Pre-owned + installments)`);
    } else {
      console.log(`   • ${product.name} already exists — left untouched`);
    }
  } else {
    const category = await prisma.category.findUnique({
      where: { slug: def.categorySlug },
      select: { id: true },
    });
    if (!category) {
      throw new Error(
        `No category with slug "${def.categorySlug}". Create it in Admin → Categories first, then re-run.`,
      );
    }
    const created = await prisma.product.create({
      data: {
        name: def.name,
        slug: def.slug,
        model: def.model,
        description: def.description,
        highlights: def.highlights,
        basePrice: money(def.storages[0]!.price),
        discountPct: def.discountPct ?? 0,
        status: ProductStatus.ACTIVE,
        releaseYear: def.releaseYear,
        isFeatured: def.flags?.isFeatured ?? false,
        isNewArrival: def.flags?.isNewArrival ?? false,
        isBestSeller: def.flags?.isBestSeller ?? false,
        isDeal: def.flags?.isDeal ?? false,
        isPreOwned: def.flags?.isPreOwned ?? false,
        installmentAvailable: INSTALLMENT_MIN_DOWN_PCT[def.slug] !== undefined,
        installmentMinDownPct: INSTALLMENT_MIN_DOWN_PCT[def.slug] ?? 0,
        categoryId: category.id,
        // Placeholder imagery only — no copyrighted product photos.
        images: {
          create: [
            { url: img(def.name), alt: `${def.name} front`, position: 0 },
            { url: img(`${def.name} back`), alt: `${def.name} back`, position: 1 },
          ],
        },
      },
      select: { id: true, name: true, isPreOwned: true, installmentAvailable: true, installmentMinDownPct: true },
    });
    product = created;
    console.log(`   ✓ Product created: ${created.name}`);
  }

  // Variants: created per missing SKU. An existing SKU keeps its current stock —
  // a re-run must never inflate on-hand units.
  let variantsCreated = 0;
  for (const storage of def.storages) {
    for (const color of def.colors) {
      const sku = skuFor(def.skuBase, storage.label, color.code);
      const existing = await prisma.productVariant.findUnique({ where: { sku }, select: { id: true } });
      if (existing) {
        console.log(`   • Variant ${sku} already exists — stock left untouched`);
        continue;
      }
      const stock = PRE_LOVED_STOCK[sku] ?? 1;
      const variant = await prisma.productVariant.create({
        data: {
          sku,
          storage: storage.label,
          color: color.name,
          colorHex: color.hex,
          price: money(storage.price),
          stock,
          lowStockThreshold: def.lowStockThreshold ?? 5,
          imageUrl: img(`${def.name} ${color.name}`),
          condition: def.unit?.condition ?? ProductCondition.NEW,
          batteryHealth: def.unit?.batteryHealth ?? null,
          conditionNote: def.unit?.conditionNote ?? null,
          productId: product.id,
        },
      });
      variantsCreated++;

      // Stock never appears without a ledger entry — and because this only runs
      // for a NEWLY created variant, a re-run adds no phantom restock.
      if (stock > 0) {
        await prisma.inventoryTransaction.create({
          data: {
            variantId: variant.id,
            type: InventoryTxnType.RESTOCK,
            previousStock: 0,
            quantityChanged: stock,
            newStock: stock,
            reason: 'Initial stock (demo data)',
            adminId: admin?.id ?? null,
          },
        });
      }
      console.log(`   ✓ Variant created: ${sku} — ${stock} on hand`);
    }
  }

  // --- 4. Demo trade-in applications ---------------------------------------
  // Deduped on the demo customer email (stable across runs and across days,
  // unlike the date-derived reference).
  let tradeInsCreated = 0;
  for (const t of TRADE_IN_DEMOS) {
    const already = await prisma.tradeIn.findFirst({
      where: { customerEmail: t.customerEmail, deviceModel: t.deviceModel },
      select: { reference: true },
    });
    if (already) {
      console.log(`   • Trade-in ${already.reference} (${t.customerName}) already exists — skipped`);
      continue;
    }
    const submittedAt = daysAgo(t.daysAgo);
    const reference = await nextReference('TRD', submittedAt);
    await prisma.tradeIn.create({
      data: {
        reference,
        customerName: t.customerName,
        customerEmail: t.customerEmail,
        customerPhone: t.customerPhone,
        deviceBrand: t.deviceBrand,
        deviceModel: t.deviceModel,
        storage: t.storage,
        color: t.color,
        condition: t.condition,
        batteryHealth: t.batteryHealth,
        hasBox: t.hasBox,
        hasCharger: t.hasCharger,
        issues: t.issues,
        branchId: branches.get(t.branchSlug) ?? null,
        status: t.status,
        // Staff-entered demo figure — nothing in this feature computes an offer.
        quotedValue: t.quotedValue != null ? money(t.quotedValue) : null,
        staffNotes: t.staffNotes,
        reviewedByAdminId: t.quotedValue != null ? (admin?.id ?? null) : null,
        createdAt: submittedAt,
      },
    });
    tradeInsCreated++;
    console.log(`   ✓ Trade-in ${reference} — ${t.customerName} (${t.status})`);
  }

  // --- 5. Demo installment plans -------------------------------------------
  let plansCreated = 0;
  for (const p of INSTALLMENT_DEMOS) {
    const already = await prisma.installmentPlan.findFirst({
      where: { customerEmail: p.customerEmail },
      select: { reference: true },
    });
    if (already) {
      console.log(`   • Installment ${already.reference} (${p.customerName}) already exists — skipped`);
      continue;
    }

    const variant = await prisma.productVariant.findUnique({
      where: { sku: p.sku },
      select: { id: true, storage: true, color: true, price: true, product: { select: { name: true } } },
    });
    if (!variant) {
      console.log(`   • No variant with SKU ${p.sku} — installment for ${p.customerName} skipped`);
      continue;
    }

    const appliedAt = daysAgo(p.daysAgo);
    const downPayment = money(p.downPayment);
    // Price comes from the DB, and the schedule from the API's own function.
    const { principal, monthlyAmount, rows } = computeSchedule(variant.price, p.termMonths, downPayment);
    if (principal.lessThanOrEqualTo(new Prisma.Decimal(0))) {
      console.log(`   • Down payment ≥ price for ${p.sku} — installment for ${p.customerName} skipped`);
      continue;
    }
    const reference = await nextReference('INS', appliedAt);

    await prisma.installmentPlan.create({
      data: {
        reference,
        customerName: p.customerName,
        customerEmail: p.customerEmail,
        customerPhone: p.customerPhone,
        // Snapshot at apply time — a later price change must not rewrite this plan.
        productName: variant.product.name,
        variantLabel: `${variant.storage} · ${variant.color}`,
        productPrice: variant.price,
        variantId: variant.id,
        branchId: branches.get(p.branchSlug) ?? null,
        termMonths: p.termMonths,
        downPayment,
        principal,
        monthlyAmount,
        status: p.status,
        staffNotes: p.staffNotes,
        approvedByAdminId: p.status === 'PENDING' ? null : (admin?.id ?? null),
        createdAt: appliedAt,
        payments: {
          create: rows.map((row) => {
            const settled = row.sequence <= p.paidRows;
            return {
              sequence: row.sequence,
              dueDate: addMonths(appliedAt, row.sequence),
              amountDue: row.amountDue,
              // Payment rows are additive: the record-payment endpoint UPDATES a
              // row in place — history is never replaced or deleted.
              amountPaid: settled ? row.amountDue : money(0),
              status: settled ? 'PAID' : 'PENDING',
              paidAt: settled ? addMonths(appliedAt, row.sequence) : null,
              method: settled ? PaymentMethod.GCASH : null,
              reference: settled ? `SIM-${reference}-${row.sequence}` : null,
              recordedByAdminId: settled ? (admin?.id ?? null) : null,
            };
          }),
        },
      },
    });
    plansCreated++;
    console.log(
      `   ✓ Installment ${reference} — ${p.customerName}, ${p.termMonths} × ₱${monthlyAmount.toString()} (${p.status})`,
    );
  }

  console.log('\n✅ Demo data added.');
  console.log(
    `   Branches created: ${branchesCreated} · installment opt-ins set: ${installmentEnabled} · ` +
      `pre-owned variants created: ${variantsCreated} · trade-ins: ${tradeInsCreated} · plans: ${plansCreated}`,
  );
  console.log('   Nothing was deleted, no prices changed, no stock adjusted.\n');
}

main()
  .catch((err) => {
    console.error('\n❌ Demo data failed:', err);
    process.exitCode = 1;
  })
  .finally(disconnectPrisma);
