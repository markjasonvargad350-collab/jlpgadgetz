/* eslint-disable no-console */
// ============================================================================
//  Seed — builds a fresh database from scratch for local development.
//
//  Creates: admin role + user, categories, the REAL product catalog
//  (prisma/catalog-defs.ts) plus the accessories defined below, an initial
//  RESTOCK InventoryTransaction per variant (stock NEVER exists without a ledger
//  entry), and a few sample orders that run through the SAME transactional flow
//  the real checkout uses (decrement stock → bump soldQty → write a SALE row).
//
//  Destructive: wipes and rebuilds. Refuses to run in production — the live
//  catalog is loaded by the additive `npm --prefix server run catalog:sync`.
//  Run with:  npm --prefix server run seed
// ============================================================================
import bcrypt from 'bcryptjs';
import {
  Prisma,
  ProductStatus,
  ProductCondition,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ShipmentStatus,
  InventoryTxnType,
  NotificationType,
  NotificationLevel,
} from '@prisma/client';
import { prisma, disconnectPrisma } from '../src/config/prisma';
import { env, isProd } from '../src/config/env';
import { WAREHOUSE, deriveDestination, routeFor } from '../src/config/delivery';
// Installment money is NEVER hand-written here: the seed calls the same
// authoritative computation the API uses at apply time.
import { computeSchedule } from '../src/config/installment';
// Demo/presentation data shared with the additive prisma/demo-data.ts script.
import { img, skuFor, BRANCH_DEFS, TRADE_IN_DEMOS, INSTALLMENT_DEMOS, type ProductDef } from './demo-defs';
// The shop's real price list, shared with the additive prisma/catalog-sync.ts.
import {
  REAL_CATALOG,
  CATALOG_CATEGORY_DEFS,
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

// --- helpers ----------------------------------------------------------------

const money = (n: number) => new Prisma.Decimal(n.toFixed(2));

const yyyymmdd = (d: Date) =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

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

// --- accessories -------------------------------------------------------------
// The phones and iPads come from ./catalog-defs (the owner's real price list).
// These five accessory listings are the shop's own and are intentionally kept
// here, unchanged: they have colours instead of condition tiers and a single
// price, so they don't fit the catalog def shape.

const ACCESSORIES: ProductDef[] = [
  {
    name: 'AirPods Pro (2nd gen)',
    slug: 'airpods-pro-2',
    model: 'AirPods Pro',
    categorySlug: 'airpods',
    description:
      'Up to 2x more Active Noise Cancellation, Adaptive Transparency, Personalized Spatial Audio, and a USB-C charging case.',
    highlights: ['Active Noise Cancellation', 'Adaptive Transparency', 'Spatial Audio', 'USB-C case'],
    releaseYear: 2023,
    skuBase: 'APP2',
    storages: [{ label: 'Standard', price: 14990 }],
    colors: [{ name: 'White', hex: '#F5F5F7', code: 'WHT' }],
    flags: { isFeatured: true, isBestSeller: true },
  },
  {
    name: 'AirPods (3rd gen)',
    slug: 'airpods-3',
    model: 'AirPods',
    categorySlug: 'airpods',
    description: 'Spatial Audio, Adaptive EQ, sweat and water resistance, and up to 30 hours of listening time.',
    highlights: ['Spatial Audio', 'Adaptive EQ', 'Water resistant', 'Up to 30h battery'],
    releaseYear: 2021,
    skuBase: 'AP3',
    storages: [{ label: 'Standard', price: 10990 }],
    colors: [{ name: 'White', hex: '#F5F5F7', code: 'WHT' }],
  },
  {
    name: '20W USB-C Power Adapter',
    slug: '20w-usb-c-power-adapter',
    model: '20W Adapter',
    categorySlug: 'chargers',
    description: 'Fast, efficient charging at home, in the office, or on the go.',
    highlights: ['Fast charging', 'Compact', 'USB-C'],
    releaseYear: 2020,
    skuBase: 'PWR20',
    storages: [{ label: 'Standard', price: 1190 }],
    colors: [{ name: 'White', hex: '#F5F5F7', code: 'WHT' }],
  },
  {
    name: 'MagSafe Charger',
    slug: 'magsafe-charger',
    model: 'MagSafe Charger',
    categorySlug: 'chargers',
    description: 'Perfectly aligned magnets snap to your iPhone for faster wireless charging up to 15W.',
    highlights: ['Up to 15W', 'Perfect alignment', 'Qi compatible'],
    releaseYear: 2020,
    skuBase: 'MAGS',
    storages: [{ label: 'Standard', price: 2490 }],
    colors: [{ name: 'White', hex: '#F5F5F7', code: 'WHT' }],
    flags: { isFeatured: true },
  },
  {
    name: 'Silicone Case with MagSafe',
    slug: 'silicone-case-magsafe',
    model: 'Silicone Case',
    categorySlug: 'cases',
    description: 'A silky, soft-touch silicone exterior with built-in magnets that align perfectly with iPhone.',
    highlights: ['Soft-touch silicone', 'Built-in magnets', 'MagSafe compatible'],
    releaseYear: 2023,
    skuBase: 'SILC',
    storages: [{ label: 'Standard', price: 2990 }],
    colors: [
      { name: 'Black', hex: '#1F2020', code: 'BLK' },
      { name: 'Storm Blue', hex: '#4A6274', code: 'STB' },
      { name: 'Clay', hex: '#C57F5D', code: 'CLY' },
    ],
  },
];

// --- deliberate stock / sales states -----------------------------------------
// So a fresh local database has a low-stock card, a sold-out card and a
// meaningful best-seller ranking before any order exists. Nothing here applies
// to the live database — catalog-sync never writes stock to an existing variant.
const STOCK_OVERRIDES: Record<string, number> = {
  'IP16-256-STD': 1, // low stock (at the standard tier's threshold of 2)
  'IP17AIR-256-STD': 0, // out of stock
};
const INITIAL_SOLD: Record<string, number> = {
  'IP15PM-256-STD': 42,
  'IP15-128-STD': 51,
  'IP14-128-STD': 60,
  'IP13-128-PRE': 24,
  'APP2-Standard-WHT': 88,
};

// --- one shape for both kinds of definition ---------------------------------
// Catalog defs carry one variant per priced row (storage × condition, two
// prices); accessory defs cross-multiply storages × colours at one price. Both
// normalise to this before a single create loop writes them.

type VariantRow = {
  sku: string;
  storage: string;
  color: string;
  colorHex: string | null;
  /** Cash price. */
  price: number;
  /** Installment base, or null to finance at the cash price. */
  installmentPrice: number | null;
  condition: ProductCondition;
  batteryHealth: number | null;
  conditionNote: string | null;
  lowStockThreshold: number;
  stock: number;
  isActive: boolean;
  imageUrl: string;
};

type SeedProduct = {
  name: string;
  slug: string;
  model: string;
  categorySlug: string;
  description: string;
  highlights: string[];
  releaseYear: number;
  basePrice: number;
  discountPct: number;
  status: ProductStatus;
  installmentAvailable: boolean;
  installmentMinDownPct: number;
  flags: ProductDef['flags'];
  rows: VariantRow[];
};

const fromCatalog = (def: CatalogProductDef): SeedProduct => ({
  name: def.name,
  slug: def.slug,
  model: def.model,
  categorySlug: def.categorySlug,
  description: def.description,
  highlights: def.highlights,
  releaseYear: def.releaseYear,
  // "From" price on the card = the cheapest cash price on the listing.
  basePrice: basePriceOf(def),
  // No discount is invented: the price list has one cash price per row, not a
  // "was" price, so nothing shows a struck-through figure.
  discountPct: 0,
  status: def.status ?? ProductStatus.ACTIVE,
  installmentAvailable: true,
  installmentMinDownPct: def.installmentMinDownPct ?? DEFAULT_MIN_DOWN_PCT,
  flags: def.flags,
  rows: def.variants.map((v) => {
    const sku = catalogSku(def, v);
    return {
      sku,
      storage: v.storage,
      // The price list has no colours, so one neutral placeholder per variant —
      // renamed per unit in Admin → Variants.
      color: PLACEHOLDER_COLOR.name,
      colorHex: PLACEHOLDER_COLOR.hex,
      price: v.cash,
      installmentPrice: v.installment,
      condition: v.condition,
      // Never guessed. Staff read it off the actual unit and type it in admin.
      batteryHealth: null,
      conditionNote: CONDITION_NOTE[v.condition],
      lowStockThreshold: lowStockThresholdOf(def, v),
      stock: isUnpriced(v) ? 0 : (STOCK_OVERRIDES[sku] ?? openingStockOf(def, v)),
      // An unpriced row exists so the owner can fill in its price, but it must
      // never be sellable at ₱0.
      isActive: !isUnpriced(v),
      imageUrl: img(`${def.name} ${v.storage}`),
    };
  }),
});

const fromAccessory = (def: ProductDef): SeedProduct => ({
  name: def.name,
  slug: def.slug,
  model: def.model,
  categorySlug: def.categorySlug,
  description: def.description,
  highlights: def.highlights,
  releaseYear: def.releaseYear,
  basePrice: def.storages[0]!.price,
  discountPct: 0,
  status: ProductStatus.ACTIVE,
  // Accessories are deliberately excluded from installments: a ₱1,190 charger
  // on a 12-month plan is not a real offer.
  installmentAvailable: false,
  installmentMinDownPct: 0,
  flags: def.flags,
  rows: def.storages.flatMap((storage) =>
    def.colors.map((color) => {
      const sku = skuFor(def.skuBase, storage.label, color.code);
      return {
        sku,
        storage: storage.label,
        color: color.name,
        colorHex: color.hex,
        price: storage.price,
        // Cash only — see installmentAvailable above.
        installmentPrice: null,
        condition: ProductCondition.NEW,
        batteryHealth: null,
        conditionNote: null,
        lowStockThreshold: 5,
        stock: STOCK_OVERRIDES[sku] ?? 25,
        isActive: true,
        imageUrl: img(`${def.name} ${color.name}`),
      };
    }),
  ),
});

async function wipe() {
  // Delete in FK-safe order.
  await prisma.trackingHistory.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.inventoryTransaction.deleteMany();
  await prisma.order.deleteMany();
  // Buy/Sell/Trade records reference variants and branches, so they go before
  // both. Payment rows cascade from their plan, but we clear them explicitly to
  // keep this function's order self-documenting.
  await prisma.installmentPayment.deleteMany();
  await prisma.installmentPlan.deleteMany();
  await prisma.tradeIn.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  // Branches last of the domain tables — orders/trade-ins/plans all point at them.
  await prisma.branch.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();
}

async function main() {
  if (isProd) {
    throw new Error('Refusing to run the destructive seed in production (NODE_ENV=production).');
  }

  console.log('🌱 Seeding database…');
  await wipe();

  // --- Roles + admin user ---------------------------------------------------
  const adminRole = await prisma.role.create({
    data: { name: 'ADMIN', description: 'Full back-office access' },
  });
  const staffRole = await prisma.role.create({
    data: { name: 'STAFF', description: 'Limited back-office access' },
  });

  const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 12);
  const admin = await prisma.user.create({
    data: {
      email: env.ADMIN_EMAIL,
      passwordHash,
      name: 'Store Administrator',
      roleId: adminRole.id,
    },
  });
  console.log(`   ✓ Admin user: ${admin.email}`);

  // Staff demo account — exercises the role gate: STAFF can browse + advance
  // fulfillment, but cancellation/refund (destructive/financial) is ADMIN-only.
  const staffPasswordHash = await bcrypt.hash(env.STAFF_PASSWORD, 12);
  const staff = await prisma.user.create({
    data: {
      email: env.STAFF_EMAIL,
      passwordHash: staffPasswordHash,
      name: 'Store Staff',
      roleId: staffRole.id,
    },
  });
  console.log(`   ✓ Staff user: ${staff.email}`);

  // --- Branches -------------------------------------------------------------
  // Defined in ./demo-defs (shared with the additive demo-data script).
  const branches = new Map<string, string>();
  for (const b of BRANCH_DEFS) {
    const created = await prisma.branch.create({ data: b });
    branches.set(b.slug, created.id);
  }
  console.log(`   ✓ ${BRANCH_DEFS.length} branches`);

  // --- Categories -----------------------------------------------------------
  // iPhone + iPad come from ./catalog-defs (shared with catalog-sync); the
  // accessory categories are the seed's own.
  const categoryDefs = [
    ...CATALOG_CATEGORY_DEFS,
    { name: 'AirPods', slug: 'airpods', description: 'Wireless audio, redefined.', position: 3 },
    { name: 'Chargers & Cables', slug: 'chargers', description: 'Power up anywhere.', position: 4 },
    { name: 'Cases & Protection', slug: 'cases', description: 'Style meets protection.', position: 5 },
  ];
  const categories = new Map<string, string>();
  for (const c of categoryDefs) {
    const cat = await prisma.category.create({ data: { ...c, imageUrl: img(c.name) } });
    categories.set(c.slug, cat.id);
  }
  console.log(`   ✓ ${categories.size} categories`);

  // --- Products + variants + initial restock ledger -------------------------
  const variantsBySku = new Map<
    string,
    {
      id: string;
      productName: string;
      color: string;
      storage: string;
      /** Cash price — what an order line charges. */
      price: Prisma.Decimal;
      /** Installment base, or null to finance at the cash price. */
      installmentPrice: Prisma.Decimal | null;
    }
  >();
  let productCount = 0;
  let variantCount = 0;

  const seedProducts: SeedProduct[] = [...REAL_CATALOG.map(fromCatalog), ...ACCESSORIES.map(fromAccessory)];

  for (const def of seedProducts) {
    const categoryId = categories.get(def.categorySlug);
    if (!categoryId) throw new Error(`Missing category for ${def.slug}`);

    const product = await prisma.product.create({
      data: {
        name: def.name,
        slug: def.slug,
        model: def.model,
        description: def.description,
        highlights: def.highlights,
        basePrice: money(def.basePrice),
        discountPct: def.discountPct,
        status: def.status,
        releaseYear: def.releaseYear,
        isFeatured: def.flags?.isFeatured ?? false,
        isNewArrival: def.flags?.isNewArrival ?? false,
        isBestSeller: def.flags?.isBestSeller ?? false,
        isDeal: def.flags?.isDeal ?? false,
        isPreOwned: def.flags?.isPreOwned ?? false,
        installmentAvailable: def.installmentAvailable,
        installmentMinDownPct: def.installmentMinDownPct,
        categoryId,
        images: {
          create: [
            { url: img(def.name), alt: `${def.name} front`, position: 0 },
            { url: img(`${def.name} back`), alt: `${def.name} back`, position: 1 },
          ],
        },
      },
    });
    productCount++;

    for (const row of def.rows) {
      const soldQty = INITIAL_SOLD[row.sku] ?? 0;

      const variant = await prisma.productVariant.create({
        data: {
          sku: row.sku,
          storage: row.storage,
          color: row.color,
          colorHex: row.colorHex,
          price: money(row.price),
          installmentPrice: row.installmentPrice != null ? money(row.installmentPrice) : null,
          stock: row.stock,
          soldQty,
          lowStockThreshold: row.lowStockThreshold,
          imageUrl: row.imageUrl,
          isActive: row.isActive,
          condition: row.condition,
          batteryHealth: row.batteryHealth,
          conditionNote: row.conditionNote,
          productId: product.id,
        },
      });
      variantCount++;
      variantsBySku.set(row.sku, {
        id: variant.id,
        productName: def.name,
        color: row.color,
        storage: row.storage,
        price: variant.price,
        installmentPrice: variant.installmentPrice,
      });

      // The opening balance is itself a ledger entry: stock never appears
      // out of thin air.
      if (row.stock > 0) {
        await prisma.inventoryTransaction.create({
          data: {
            variantId: variant.id,
            type: InventoryTxnType.RESTOCK,
            previousStock: 0,
            quantityChanged: row.stock,
            newStock: row.stock,
            reason: 'Initial stock (seed)',
            adminId: admin.id,
          },
        });
      }
    }
  }
  console.log(`   ✓ ${productCount} products, ${variantCount} variants (+ restock ledger)`);

  // --- Sample orders (run through the real transactional flow) --------------
  type OrderLine = { sku: string; qty: number };
  type SampleOrder = {
    seq: number;
    placedAt: Date;
    customer: { name: string; email: string; phone: string };
    address: { addressLine: string; barangay: string; city: string; province: string; postalCode: string };
    lines: OrderLine[];
    method: PaymentMethod;
    paymentStatus: PaymentStatus;
    orderStatus: OrderStatus;
    shipmentStatus: ShipmentStatus;
    deliveryFee: number;
    // How far along the simulated route the rider is (0..N waypoints included).
    trackingUpTo: OrderStatus;
  };

  const sampleOrders: SampleOrder[] = [
    {
      seq: 1,
      placedAt: daysAgo(6),
      customer: { name: 'Maria Santos', email: 'maria.santos@example.com', phone: '+639171234567' },
      address: {
        addressLine: '24 Katipunan Ave',
        barangay: 'Loyola Heights',
        city: 'Quezon City',
        province: 'Metro Manila',
        postalCode: '1108',
      },
      lines: [{ sku: 'IP15PM-256-STD', qty: 1 }],
      method: PaymentMethod.GCASH,
      paymentStatus: PaymentStatus.PAID,
      orderStatus: OrderStatus.DELIVERED,
      shipmentStatus: ShipmentStatus.DELIVERED,
      deliveryFee: 0,
      trackingUpTo: OrderStatus.DELIVERED,
    },
    {
      seq: 2,
      placedAt: daysAgo(1),
      customer: { name: 'Jose Dela Cruz', email: 'jose.delacruz@example.com', phone: '+639182345678' },
      address: {
        addressLine: '88 Shaw Blvd',
        barangay: 'Highway Hills',
        city: 'Mandaluyong',
        province: 'Metro Manila',
        postalCode: '1550',
      },
      lines: [
        { sku: 'IP15-128-STD', qty: 1 },
        { sku: 'APP2-Standard-WHT', qty: 1 },
      ],
      method: PaymentMethod.GCASH,
      paymentStatus: PaymentStatus.PAID,
      orderStatus: OrderStatus.OUT_FOR_DELIVERY,
      shipmentStatus: ShipmentStatus.OUT_FOR_DELIVERY,
      deliveryFee: 0,
      trackingUpTo: OrderStatus.OUT_FOR_DELIVERY,
    },
    {
      seq: 3,
      placedAt: new Date(),
      customer: { name: 'Ana Reyes', email: 'ana.reyes@example.com', phone: '+639193456789' },
      address: {
        addressLine: '12 Rizal St',
        barangay: 'Poblacion',
        city: 'Makati',
        province: 'Metro Manila',
        postalCode: '1210',
      },
      lines: [{ sku: 'IP14-128-STD', qty: 1 }],
      method: PaymentMethod.COD,
      paymentStatus: PaymentStatus.PENDING,
      orderStatus: OrderStatus.RECEIVED,
      shipmentStatus: ShipmentStatus.PENDING,
      deliveryFee: 150,
      trackingUpTo: OrderStatus.RECEIVED,
    },
  ];

  for (const so of sampleOrders) {
    await prisma.$transaction(async (tx) => {
      // Resolve lines against seeded variants, snapshotting details.
      const items = so.lines.map((line) => {
        const v = variantsBySku.get(line.sku);
        if (!v) throw new Error(`Sample order references unknown SKU ${line.sku}`);
        // Orders always charge the CASH price, never the installment base.
        const lineTotal = v.price.mul(line.qty);
        return {
          variantId: v.id,
          productName: v.productName,
          variantLabel: `${v.storage} · ${v.color}`,
          sku: line.sku,
          unitPrice: v.price,
          quantity: line.qty,
          lineTotal,
        };
      });

      const subtotal = items.reduce((acc, it) => acc.add(it.lineTotal), new Prisma.Decimal(0));
      const total = subtotal.add(money(so.deliveryFee));
      const orderNumber = `ORD-${yyyymmdd(so.placedAt)}-${String(so.seq).padStart(4, '0')}`;

      const order = await tx.order.create({
        data: {
          orderNumber,
          customerName: so.customer.name,
          customerEmail: so.customer.email,
          customerPhone: so.customer.phone,
          addressLine: so.address.addressLine,
          barangay: so.address.barangay,
          city: so.address.city,
          province: so.address.province,
          postalCode: so.address.postalCode,
          subtotal,
          deliveryFee: money(so.deliveryFee),
          total,
          paymentMethod: so.method,
          paymentStatus: so.paymentStatus,
          status: so.orderStatus,
          createdAt: so.placedAt,
          items: { create: items },
          payment: {
            create: {
              method: so.method,
              status: so.paymentStatus,
              amount: total,
              reference: so.method === PaymentMethod.COD ? null : `SIM-${orderNumber}`,
              paidAt: so.paymentStatus === PaymentStatus.PAID ? so.placedAt : null,
            },
          },
        },
      });

      // Deduct inventory + record SALE transactions (the real oversell-safe flow).
      for (const it of items) {
        const variant = await tx.productVariant.findUniqueOrThrow({ where: { id: it.variantId! } });
        const newStock = variant.stock - it.quantity;
        if (newStock < 0) throw new Error(`Seed oversell for ${it.sku}`);
        await tx.productVariant.update({
          where: { id: variant.id },
          data: { stock: newStock, soldQty: { increment: it.quantity } },
        });
        await tx.inventoryTransaction.create({
          data: {
            variantId: variant.id,
            type: InventoryTxnType.SALE,
            previousStock: variant.stock,
            quantityChanged: -it.quantity,
            newStock,
            reason: `Sale — ${orderNumber}`,
            orderId: order.id,
          },
        });
      }

      // Shipment + tracking history up to the order's current milestone.
      // Destination is derived from the order's city (shared config/delivery.ts).
      const dest = deriveDestination(so.address.city);
      const route = routeFor(dest);
      const milestones = route.slice(0, route.findIndex((r) => r.status === so.trackingUpTo) + 1);
      const last = milestones[milestones.length - 1]!;
      await tx.shipment.create({
        data: {
          orderId: order.id,
          status: so.shipmentStatus,
          courier: 'JLP Express',
          trackingCode: `IEX${yyyymmdd(so.placedAt)}${so.seq}`,
          originLat: WAREHOUSE.lat,
          originLng: WAREHOUSE.lng,
          destLat: dest.lat,
          destLng: dest.lng,
          currentLat: last.lat,
          currentLng: last.lng,
          estimatedArrival: so.orderStatus === OrderStatus.DELIVERED ? so.placedAt : daysAgo(-2),
          deliveredAt: so.orderStatus === OrderStatus.DELIVERED ? so.placedAt : null,
          history: {
            create: milestones.map((m, idx) => ({
              status: m.status,
              note: m.note,
              lat: m.lat,
              lng: m.lng,
              createdAt: new Date(so.placedAt.getTime() + idx * 60 * 60 * 1000),
            })),
          },
        },
      });

      console.log(`   ✓ Order ${orderNumber} (${so.orderStatus})`);
    });
  }

  // --- Demo trade-in applications -------------------------------------------
  // So Admin → Trade-ins isn't empty on a fresh install. The definitions live in
  // ./demo-defs so the additive demo-data script creates the identical rows.
  for (const t of TRADE_IN_DEMOS) {
    const submittedAt = daysAgo(t.daysAgo);
    const reference = `TRD-${yyyymmdd(submittedAt)}-${String(t.seq).padStart(4, '0')}`;
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
        quotedValue: t.quotedValue != null ? money(t.quotedValue) : null,
        staffNotes: t.staffNotes,
        reviewedByAdminId: t.quotedValue != null ? admin.id : null,
        createdAt: submittedAt,
      },
    });
    console.log(`   ✓ Trade-in ${reference} (${t.status})`);
  }

  // --- Demo installment applications ----------------------------------------
  // Both plans get their money from `computeSchedule` — the SAME function the API
  // uses — so the seed can't drift from the live math: monthly = principal ÷ term
  // with no interest or fees, and the final row absorbs the rounding remainder.
  for (const p of INSTALLMENT_DEMOS) {
    const appliedAt = daysAgo(p.daysAgo);
    const v = variantsBySku.get(p.sku);
    if (!v) throw new Error(`Demo installment references unknown SKU ${p.sku}`);

    // A plan divides the INSTALLMENT base price, not the cash price.
    const financedPrice = v.installmentPrice ?? v.price;
    const downPayment = money(p.downPayment);
    const { principal, monthlyAmount, rows } = computeSchedule(financedPrice, p.termMonths, downPayment);
    const reference = `INS-${yyyymmdd(appliedAt)}-${String(p.seq).padStart(4, '0')}`;

    await prisma.installmentPlan.create({
      data: {
        reference,
        customerName: p.customerName,
        customerEmail: p.customerEmail,
        customerPhone: p.customerPhone,
        // Snapshot at apply time — the live variant price may change later, this
        // plan's price must not.
        productName: v.productName,
        variantLabel: `${v.storage} · ${v.color}`,
        productPrice: financedPrice,
        variantId: v.id,
        branchId: branches.get(p.branchSlug) ?? null,
        termMonths: p.termMonths,
        downPayment,
        principal,
        monthlyAmount,
        status: p.status,
        staffNotes: p.staffNotes,
        approvedByAdminId: p.status === 'PENDING' ? null : admin.id,
        createdAt: appliedAt,
        payments: {
          create: rows.map((row) => {
            const settled = row.sequence <= p.paidRows;
            return {
              sequence: row.sequence,
              dueDate: addMonths(appliedAt, row.sequence),
              amountDue: row.amountDue,
              // Payment rows are additive: a settled row is UPDATED in place by
              // the record-payment endpoint, never replaced or deleted.
              amountPaid: settled ? row.amountDue : money(0),
              status: settled ? 'PAID' : 'PENDING',
              paidAt: settled ? addMonths(appliedAt, row.sequence) : null,
              method: settled ? PaymentMethod.GCASH : null,
              reference: settled ? `SIM-${reference}-${row.sequence}` : null,
              recordedByAdminId: settled ? admin.id : null,
            };
          }),
        },
      },
    });
    console.log(
      `   ✓ Installment ${reference} — ${p.termMonths} × ${monthlyAmount.toString()} (${p.status})`,
    );
  }

  // --- Notifications + audit log --------------------------------------------
  await prisma.notification.createMany({
    data: [
      {
        type: NotificationType.LOW_STOCK,
        level: NotificationLevel.WARNING,
        title: 'Low stock',
        message: 'iPhone 16 (256GB · Standard) is running low (1 left).',
        entityType: 'ProductVariant',
      },
      {
        type: NotificationType.OUT_OF_STOCK,
        level: NotificationLevel.ERROR,
        title: 'Out of stock',
        message: 'iPhone 17 Air (256GB · Standard) is out of stock.',
        entityType: 'ProductVariant',
      },
      {
        type: NotificationType.NEW_ORDER,
        level: NotificationLevel.INFO,
        title: 'New order',
        message: 'Order ORD received from Ana Reyes.',
        entityType: 'Order',
      },
    ],
  });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      action: 'seed.run',
      entityType: 'System',
      meta: {
        productCount,
        variantCount,
        orders: sampleOrders.length,
        tradeIns: TRADE_IN_DEMOS.length,
        installmentPlans: INSTALLMENT_DEMOS.length,
      },
    },
  });

  console.log('✅ Seed complete.');
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrisma();
  });
