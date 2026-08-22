/* eslint-disable no-console */
// ============================================================================
//  Catalog sync — loads JLP's REAL price list (prisma/catalog-defs.ts).
//
//  ADDITIVE and re-runnable. Safe against the LIVE database: `prisma/seed.ts`
//  wipes every table and refuses NODE_ENV=production, so it can never be used on
//  a database that's already serving customers. This script is how the real
//  catalog gets there.
//
//  What it writes, and only this:
//    1. Categories  — creates `iphone` / `ipad` if either is missing.
//    2. Products    — the 26 listings in catalog-defs, by slug: created if new,
//                     otherwise updated to match the file (see the split below).
//    3. Variants    — one per priced row of the sheet, by SKU: created with an
//                     opening-stock ledger entry, otherwise re-priced.
//    4. Retirement  — the old demo variants are deactivated and their stock is
//                     zeroed through the ledger; the 3 demo listings with no real
//                     counterpart are ARCHIVED.
//
//  Who owns what, on a re-run:
//    • This file owns   — name, model, description, highlights, base price,
//                         flags, installment settings, category, and each
//                         variant's cash + installment price.
//    • The owner owns   — publish status, photos, stock, colours, battery health,
//                         condition notes, low-stock thresholds, and any variant
//                         they add in admin. None of these are ever overwritten.
//
//  What it will NEVER do:
//    • delete a product, variant, order, or ledger row — retirement is
//      deactivation + ARCHIVED, so all history survives
//    • change stock on a variant that already exists
//    • touch accessories, orders, payments, trade-ins, plans, users or branches
//    • change a price that isn't on the sheet yet (an unpriced row is created
//      once, then left alone for the owner to price in admin)
//    • write to a SKU that belongs to a different listing — that's reported and
//      SKIPPED, and the run exits non-zero so the clash can't pass unnoticed
//
//  Preview everything first — this writes nothing:
//      DATABASE_URL="<live-connection-string>" npm --prefix server run catalog:sync -- --dry-run
//
//  Then, for real (the connection string is a secret — don't commit or share it):
//      DATABASE_URL="<live-connection-string>" npm --prefix server run catalog:sync
//
//  Run it AFTER the migrations are applied: the STANDARD condition value and the
//  ProductVariant.installmentPrice column must exist first. On Render that
//  happens automatically on deploy (`prisma migrate deploy` in the start command).
// ============================================================================
import { Prisma, ProductStatus, InventoryTxnType } from '@prisma/client';
import { prisma, disconnectPrisma } from '../src/config/prisma';
import { money } from '../src/utils/money';
import { recordInventoryChange } from '../src/services/inventory.service';
import { img } from './demo-defs';
import {
  REAL_CATALOG,
  CATALOG_CATEGORY_DEFS,
  RETIRED_DEMO_SLUGS,
  retiredDemoSkus,
  CONDITION_NOTE,
  PLACEHOLDER_COLOR,
  DEFAULT_MIN_DOWN_PCT,
  basePriceOf,
  catalogSku,
  isUnpriced,
  lowStockThresholdOf,
  openingStockOf,
  type CatalogProductDef,
} from './catalog-defs';

/** `--dry-run` prints the exact plan and writes nothing. */
const DRY = process.argv.includes('--dry-run');
const would = DRY ? 'would ' : '';

const counters = {
  categoriesCreated: 0,
  productsCreated: 0,
  productsUpdated: 0,
  variantsCreated: 0,
  variantsRepriced: 0,
  variantsRetired: 0,
  unitsZeroed: 0,
  productsArchived: 0,
  imagesAdded: 0,
};

/**
 * SKUs in `catalog-defs` that a DIFFERENT listing already owns. A SKU is unique
 * shop-wide, so re-pricing one of these would mutate someone else's variant and
 * silently leave this listing without its option. Collected rather than thrown on
 * so one run reports every conflict; the run then exits non-zero.
 */
const conflicts: string[] = [];

/** Stands in for the id of a category this run would create (dry run only). */
const DRY_NEW_CATEGORY = '(new category)';

// ── Diffing, so a re-run says exactly what it changed and nothing more ───────

type Row = Record<string, unknown>;

const sameValue = (a: unknown, b: unknown): boolean => {
  if (a instanceof Prisma.Decimal || b instanceof Prisma.Decimal) {
    if (a == null || b == null) return a == null && b == null;
    return new Prisma.Decimal(a as Prisma.Decimal.Value).equals(new Prisma.Decimal(b as Prisma.Decimal.Value));
  }
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => x === b[i]);
  return a === b;
};

const show = (v: unknown): string => {
  if (v == null) return '∅';
  if (Array.isArray(v)) return `${v.length} item(s)`;
  const s = String(v);
  return s.length > 48 ? `${s.slice(0, 45)}…` : s;
};

/** Fields of `after` that differ from `before`, rendered for the log. */
const diffOf = (before: Row, after: Row): string[] =>
  Object.entries(after)
    .filter(([k, v]) => !sameValue(before[k], v))
    .map(([k, v]) => `${k}: ${show(before[k])} → ${show(v)}`);

// ── Steps ───────────────────────────────────────────────────────────────────

/**
 * Category ids by slug. A missing category is appended AFTER the last existing
 * one: the storefront orders categories by `position` with no tiebreaker, so two
 * categories sharing a position would order non-deterministically.
 */
async function syncCategories(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const c of CATALOG_CATEGORY_DEFS) {
    const existing = await prisma.category.findUnique({ where: { slug: c.slug }, select: { id: true, name: true } });
    if (existing) {
      ids.set(c.slug, existing.id);
      console.log(`   • Category ${existing.name} already exists — left untouched`);
      continue;
    }
    const last = await prisma.category.findFirst({ orderBy: { position: 'desc' }, select: { position: true } });
    const position = (last?.position ?? 0) + 1;
    if (DRY) {
      ids.set(c.slug, DRY_NEW_CATEGORY);
      console.log(`   ${would}create category: ${c.name} (position ${position})`);
      counters.categoriesCreated++;
      continue;
    }
    const created = await prisma.category.create({
      data: { name: c.name, slug: c.slug, description: c.description, position, imageUrl: img(c.name) },
    });
    ids.set(c.slug, created.id);
    counters.categoriesCreated++;
    console.log(`   ✓ Category created: ${c.name} (position ${position})`);
  }
  return ids;
}

/** The fields catalog-defs owns on a Product. Status and images are excluded. */
const productFields = (def: CatalogProductDef, categoryId: string) => {
  const basePrice = basePriceOf(def);
  return {
    name: def.name,
    model: def.model,
    description: def.description,
    highlights: def.highlights,
    // Skipped while the sheet has no price for this listing, so a price the
    // owner types in admin is never reset to ₱0 by a re-run.
    ...(basePrice > 0 ? { basePrice: money(basePrice) } : {}),
    discountPct: 0,
    releaseYear: def.releaseYear,
    isFeatured: def.flags?.isFeatured ?? false,
    isNewArrival: def.flags?.isNewArrival ?? false,
    isBestSeller: def.flags?.isBestSeller ?? false,
    isDeal: def.flags?.isDeal ?? false,
    isPreOwned: def.flags?.isPreOwned ?? false,
    installmentAvailable: true,
    installmentMinDownPct: def.installmentMinDownPct ?? DEFAULT_MIN_DOWN_PCT,
    categoryId,
  };
};

/**
 * Create or adopt one listing. Returns its id — or `null` in a dry run for a
 * listing that doesn't exist yet, which tells `syncVariants` every option below
 * it would be created too.
 */
async function syncProduct(def: CatalogProductDef, categoryId: string): Promise<string | null> {
  const existing = await prisma.product.findUnique({
    where: { slug: def.slug },
    select: {
      id: true,
      status: true,
      name: true,
      model: true,
      description: true,
      highlights: true,
      basePrice: true,
      discountPct: true,
      releaseYear: true,
      isFeatured: true,
      isNewArrival: true,
      isBestSeller: true,
      isDeal: true,
      isPreOwned: true,
      installmentAvailable: true,
      installmentMinDownPct: true,
      categoryId: true,
      _count: { select: { images: true } },
    },
  });

  const status = def.status ?? ProductStatus.ACTIVE;

  if (!existing) {
    counters.productsCreated++;
    if (DRY) {
      console.log(`   ${would}create product: ${def.name} (${status}) + ${def.variants.length} variant(s)`);
      return null;
    }
    const created = await prisma.product.create({
      data: {
        ...productFields(def, categoryId),
        slug: def.slug,
        // Unpriced listings are created as DRAFT, so nothing renders at ₱0.
        basePrice: money(basePriceOf(def)),
        status,
        // Placeholder imagery only — no copyrighted product photos. The owner
        // replaces these with photos of the actual units.
        images: {
          create: [
            { url: img(def.name), alt: `${def.name} front`, position: 0 },
            { url: img(`${def.name} back`), alt: `${def.name} back`, position: 1 },
          ],
        },
      },
      select: { id: true },
    });
    counters.imagesAdded += 2;
    console.log(`   ✓ Product created: ${def.name} (${status})`);
    return created.id;
  }

  // Adopting an existing listing (including the demo iPhones that share a slug
  // with a real model).
  const data = productFields(def, categoryId);
  const changes = diffOf(existing as Row, data as Row);
  if (changes.length) {
    if (!DRY) await prisma.product.update({ where: { id: existing.id }, data });
    counters.productsUpdated++;
    console.log(`   ✓ ${def.name} ${would}updated — ${changes.join('; ')}`);
  } else {
    console.log(`   • ${def.name} already matches the price list — left untouched`);
  }

  // Publish state belongs to the owner: archiving is the documented way to
  // retire a listing, and a sync must not un-retire it.
  if (existing.status !== status) {
    console.log(`      ℹ status is ${existing.status} (this file says ${status}) — left as you set it`);
  }
  if (existing._count.images === 0) {
    if (!DRY) {
      await prisma.productImage.createMany({
        data: [
          { productId: existing.id, url: img(def.name), alt: `${def.name} front`, position: 0 },
          { productId: existing.id, url: img(`${def.name} back`), alt: `${def.name} back`, position: 1 },
        ],
      });
    }
    counters.imagesAdded += 2;
    console.log(`      ${would}add 2 placeholder images (this listing has none)`);
  }

  return existing.id;
}

/**
 * Create or re-price the variants of one listing. `productId` is null only in a
 * dry run for a listing that doesn't exist yet — every option is then new, and
 * the SKU lookup below still runs so clashes surface in the preview.
 */
async function syncVariants(def: CatalogProductDef, productId: string | null, adminId: string | null) {
  for (const v of def.variants) {
    const sku = catalogSku(def, v);
    const existing = await prisma.productVariant.findUnique({
      where: { sku },
      select: {
        id: true,
        productId: true,
        storage: true,
        price: true,
        installmentPrice: true,
        condition: true,
        stock: true,
      },
    });

    // A SKU is unique shop-wide, so a hit on a DIFFERENT listing is a real clash
    // — most likely a code the owner typed in admin. Re-pricing it would mutate a
    // variant this file doesn't own and still leave this listing an option short,
    // so the row is skipped and the run fails at the end with the full list.
    if (existing && existing.productId !== productId) {
      conflicts.push(sku);
      console.log(`      ⚠ ${sku} already belongs to another listing — SKIPPED (rename that one in admin, then re-run)`);
      continue;
    }

    if (!existing) {
      const opening = openingStockOf(def, v);
      counters.variantsCreated++;
      const priceLabel = isUnpriced(v)
        ? 'no price on the sheet — created inactive for you to price'
        : `cash ₱${v.cash.toLocaleString('en-PH')} · installment ₱${(v.installment ?? v.cash).toLocaleString('en-PH')}`;
      if (DRY || productId == null) {
        console.log(`      ${would}create variant ${sku} — ${v.condition}, ${priceLabel}, ${opening} on hand`);
        continue;
      }
      // Variant + opening balance commit together: stock never exists without a
      // ledger row, so it's created at 0 and moved by the ledger helper.
      await prisma.$transaction(async (tx) => {
        const created = await tx.productVariant.create({
          data: {
            sku,
            storage: v.storage,
            color: PLACEHOLDER_COLOR.name,
            colorHex: PLACEHOLDER_COLOR.hex,
            price: money(v.cash),
            installmentPrice: v.installment != null ? money(v.installment) : null,
            stock: 0,
            lowStockThreshold: lowStockThresholdOf(def, v),
            isActive: !isUnpriced(v),
            condition: v.condition,
            // Battery health is never guessed — staff read it off the unit.
            batteryHealth: null,
            conditionNote: CONDITION_NOTE[v.condition],
            imageUrl: img(`${def.name} ${v.storage}`),
            productId,
          },
          select: { id: true },
        });
        if (opening > 0) {
          await recordInventoryChange(tx, {
            variantId: created.id,
            type: InventoryTxnType.RESTOCK,
            quantityChanged: opening,
            reason: 'Opening stock (catalog sync)',
            adminId,
          });
        }
      });
      console.log(`      ✓ Variant created: ${sku} — ${v.condition}, ${priceLabel}, ${opening} on hand`);
      continue;
    }

    if (isUnpriced(v)) {
      console.log(`      • ${sku} has no price on the sheet — left exactly as it is in admin`);
      continue;
    }

    // Only the two prices and the two structural fields. Colour, photo, stock,
    // battery health, condition note, threshold and active flag stay as the
    // owner left them.
    const data = {
      storage: v.storage,
      price: money(v.cash),
      installmentPrice: v.installment != null ? money(v.installment) : null,
      condition: v.condition,
    };
    const changes = diffOf(existing as Row, data as Row);
    if (!changes.length) {
      console.log(`      • ${sku} already priced correctly — left untouched`);
      continue;
    }
    if (!DRY) await prisma.productVariant.update({ where: { id: existing.id }, data });
    counters.variantsRepriced++;
    console.log(`      ✓ ${sku} ${would}re-priced — ${changes.join('; ')}`);
  }
}

/**
 * Deactivate the old demo variants and zero their stock through the ledger, so
 * admin's on-hand totals aren't inflated by units that never existed. Rows are
 * kept: an order that referenced one keeps its history.
 */
async function retireDemoVariants(adminId: string | null) {
  for (const sku of retiredDemoSkus()) {
    const v = await prisma.productVariant.findUnique({
      where: { sku },
      select: { id: true, stock: true, isActive: true, product: { select: { name: true } } },
    });
    if (!v) continue; // never existed on this database
    if (!v.isActive && v.stock === 0) {
      console.log(`   • ${sku} already retired — left untouched`);
      continue;
    }
    counters.variantsRetired++;
    counters.unitsZeroed += v.stock;
    const detail = v.stock > 0 ? `deactivate + zero ${v.stock} unit(s)` : 'deactivate';
    if (DRY) {
      console.log(`   ${would}retire ${sku} (${v.product.name}) — ${detail}`);
      continue;
    }
    await prisma.$transaction(async (tx) => {
      if (v.stock !== 0) {
        await recordInventoryChange(tx, {
          variantId: v.id,
          type: InventoryTxnType.ADJUSTMENT,
          quantityChanged: -v.stock,
          reason: 'Retired demo variant (catalog sync)',
          adminId,
          // Compare-and-set: if someone moved this stock meanwhile, fail loudly
          // rather than writing a ledger row that doesn't reconcile.
          expectedStock: v.stock,
        });
      }
      if (v.isActive) {
        await tx.productVariant.update({ where: { id: v.id }, data: { isActive: false } });
      }
    });
    console.log(`   ✓ Retired ${sku} (${v.product.name}) — ${detail}`);
  }
}

/** Archive the demo listings that have no counterpart in the real price list. */
async function archiveDemoProducts() {
  for (const slug of RETIRED_DEMO_SLUGS) {
    const p = await prisma.product.findUnique({ where: { slug }, select: { id: true, name: true, status: true } });
    if (!p) {
      console.log(`   • No product with slug "${slug}" — nothing to archive`);
      continue;
    }
    if (p.status === ProductStatus.ARCHIVED) {
      console.log(`   • ${p.name} already archived — left untouched`);
      continue;
    }
    counters.productsArchived++;
    if (DRY) {
      console.log(`   ${would}archive ${p.name} (was ${p.status}) — hidden from the store, history kept`);
      continue;
    }
    await prisma.product.update({ where: { id: p.id }, data: { status: ProductStatus.ARCHIVED } });
    console.log(`   ✓ Archived ${p.name} — hidden from the store, history kept`);
  }
}

async function main() {
  console.log(
    DRY
      ? '\n📋 Catalog sync — DRY RUN. Nothing is written; this is the plan.\n'
      : '\n📦 Catalog sync — loading the real price list (additive; nothing is deleted)\n',
  );

  // Provenance for the ledger rows. Optional, so a database with no admin user
  // yet still works.
  const admin = await prisma.user.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true },
  });
  const adminId = admin?.id ?? null;
  console.log(
    admin ? `   ℹ Stock movements attributed to ${admin.email}` : '   ℹ No admin user found — stock provenance left blank',
  );

  console.log('\n── Categories ──');
  const categoryIds = await syncCategories();

  console.log('\n── Products & variants ──');
  for (const def of REAL_CATALOG) {
    const categoryId = categoryIds.get(def.categorySlug);
    if (categoryId === undefined) {
      throw new Error(`No category def for "${def.categorySlug}" (product ${def.slug}) — check catalog-defs.ts`);
    }
    const productId = await syncProduct(def, categoryId);
    // A null id means "dry run on a listing that doesn't exist yet" — the
    // variants are still walked, so the preview accounts for every row of the
    // sheet instead of only the ones under listings that already exist.
    await syncVariants(def, productId, adminId);
  }

  console.log('\n── Retiring the demo catalog ──');
  await retireDemoVariants(adminId);
  await archiveDemoProducts();

  // Proof that nothing outside the price list was touched: every write above is
  // keyed by a slug or SKU from catalog-defs, and these are the rest.
  console.log('\n── Left completely untouched ──');
  const owned = new Set([...REAL_CATALOG.map((d) => d.slug), ...RETIRED_DEMO_SLUGS]);
  const others = await prisma.product.findMany({
    select: { name: true, slug: true },
    orderBy: { name: 'asc' },
  });
  const untouched = others.filter((p) => !owned.has(p.slug));
  console.log(
    untouched.length
      ? `   ${untouched.length} product(s): ${untouched.map((p) => p.name).join(', ')}`
      : '   (no other products on this database)',
  );

  if (!DRY) {
    await prisma.auditLog.create({
      data: {
        adminId,
        action: 'catalog.sync',
        entityType: 'System',
        meta: counters,
      },
    });
  }

  console.log(DRY ? '\n📋 Dry run complete — nothing was written.' : '\n✅ Catalog sync complete.');
  console.log(
    `   Categories ${would}created: ${counters.categoriesCreated} · products ${would}created: ${counters.productsCreated}, ` +
      `updated: ${counters.productsUpdated}, archived: ${counters.productsArchived}`,
  );
  console.log(
    `   Variants ${would}created: ${counters.variantsCreated}, re-priced: ${counters.variantsRepriced}, ` +
      `retired: ${counters.variantsRetired} (${counters.unitsZeroed} phantom unit(s) zeroed) · ` +
      `placeholder images added: ${counters.imagesAdded}`,
  );
  console.log('   No product, variant, order or ledger row was deleted. No existing stock was changed.\n');

  // Last, so the summary above is still printed: a skipped SKU means this
  // listing is missing an option, which is a failure even though every other
  // write succeeded. Re-running after the rename is safe — nothing here is
  // applied twice.
  if (conflicts.length) {
    throw new Error(
      `${conflicts.length} SKU(s) already belong to a different listing and were SKIPPED: ${conflicts.join(', ')}.\n` +
        '   Rename them in admin (Products → that listing → Variants → Edit → SKU), then re-run.',
    );
  }
}

main()
  .catch((err) => {
    console.error('\n❌ Catalog sync failed:', err);
    process.exitCode = 1;
  })
  .finally(disconnectPrisma);
