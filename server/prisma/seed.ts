/* eslint-disable no-console */
// ============================================================================
//  Seed — populates a fresh database with realistic demo data.
//
//  Creates: admin role + user, categories, 10 iPhones + accessories with
//  storage×color variants, an initial RESTOCK InventoryTransaction per variant
//  (stock NEVER exists without a ledger entry), plus a few sample orders that
//  run through the SAME transactional flow the real checkout uses
//  (decrement stock → bump soldQty → write a SALE transaction).
//
//  Idempotent: wipes and rebuilds. Refuses to run in production.
//  Run with:  npm --prefix server run seed
// ============================================================================
import bcrypt from 'bcryptjs';
import {
  Prisma,
  ProductStatus,
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

// --- helpers ----------------------------------------------------------------

const money = (n: number) => new Prisma.Decimal(n.toFixed(2));

/** placehold.co image, on-brand Sunset Glass colors, clearly a placeholder. */
const img = (text: string) =>
  `https://placehold.co/1000x1000/FFF9F4/F4590A?text=${encodeURIComponent(text)}`;

const yyyymmdd = (d: Date) =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

// Metro Manila coordinates for the simulated delivery map.
const WAREHOUSE = { lat: 14.5995, lng: 120.9842, label: 'iStore Warehouse — Manila' };
const HUB = { lat: 14.6349, lng: 121.0177, label: 'Distribution Hub — San Juan' };
const DESTINATION = { lat: 14.676, lng: 121.0437, label: 'Quezon City' };

// --- color palettes ---------------------------------------------------------

type Color = { name: string; hex: string; code: string };

const TITANIUM: Color[] = [
  { name: 'Natural Titanium', hex: '#B7B4A8', code: 'NT' },
  { name: 'Blue Titanium', hex: '#5E6472', code: 'BT' },
  { name: 'White Titanium', hex: '#F2F1EC', code: 'WT' },
  { name: 'Black Titanium', hex: '#3B3B3D', code: 'KT' },
];
const GEN15: Color[] = [
  { name: 'Black', hex: '#1F2020', code: 'BLK' },
  { name: 'Blue', hex: '#D5E0E6', code: 'BLU' },
  { name: 'Green', hex: '#D7E8D9', code: 'GRN' },
  { name: 'Pink', hex: '#F5D9DE', code: 'PNK' },
];
const GEN14: Color[] = [
  { name: 'Midnight', hex: '#1B1B1F', code: 'MID' },
  { name: 'Starlight', hex: '#F4F2ED', code: 'STL' },
  { name: 'Purple', hex: '#E5DEEC', code: 'PRP' },
  { name: '(PRODUCT)RED', hex: '#C50A18', code: 'RED' },
];
const GEN13: Color[] = [
  { name: 'Midnight', hex: '#1B1B1F', code: 'MID' },
  { name: 'Starlight', hex: '#F4F2ED', code: 'STL' },
  { name: 'Blue', hex: '#3C6E9A', code: 'BLU' },
  { name: 'Pink', hex: '#F5D9DE', code: 'PNK' },
];
const SE_COLORS: Color[] = [
  { name: 'Midnight', hex: '#1B1B1F', code: 'MID' },
  { name: 'Starlight', hex: '#F4F2ED', code: 'STL' },
  { name: '(PRODUCT)RED', hex: '#C50A18', code: 'RED' },
];

// --- catalog definition ------------------------------------------------------

type StorageDef = { label: string; price: number };
type ProductDef = {
  name: string;
  slug: string;
  model: string;
  categorySlug: string;
  description: string;
  highlights: string[];
  releaseYear: number;
  skuBase: string;
  storages: StorageDef[];
  colors: Color[];
  discountPct?: number;
  flags?: Partial<{
    isFeatured: boolean;
    isNewArrival: boolean;
    isBestSeller: boolean;
    isDeal: boolean;
  }>;
};

const IPHONES: ProductDef[] = [
  {
    name: 'iPhone 15 Pro Max',
    slug: 'iphone-15-pro-max',
    model: 'iPhone 15 Pro Max',
    categorySlug: 'iphone',
    description:
      'The most advanced iPhone ever. Forged in aerospace-grade titanium with the powerful A17 Pro chip, a customizable Action button, and the most capable 5x Telephoto camera on iPhone.',
    highlights: ['6.7" Super Retina XDR display', 'A17 Pro chip', '5x Telephoto camera', 'Titanium design'],
    releaseYear: 2023,
    skuBase: 'IP15PM',
    storages: [
      { label: '256GB', price: 89990 },
      { label: '512GB', price: 102990 },
      { label: '1TB', price: 114990 },
    ],
    colors: TITANIUM,
    flags: { isFeatured: true, isBestSeller: true, isNewArrival: true },
  },
  {
    name: 'iPhone 15 Pro',
    slug: 'iphone-15-pro',
    model: 'iPhone 15 Pro',
    categorySlug: 'iphone',
    description:
      'Titanium. So strong. So light. So Pro. Powered by A17 Pro for console-level gaming and pro-grade cameras with the new Action button.',
    highlights: ['6.1" Super Retina XDR display', 'A17 Pro chip', 'Pro camera system', 'Action button'],
    releaseYear: 2023,
    skuBase: 'IP15P',
    storages: [
      { label: '128GB', price: 79990 },
      { label: '256GB', price: 89990 },
      { label: '512GB', price: 102990 },
    ],
    colors: TITANIUM,
    flags: { isFeatured: true, isBestSeller: true, isNewArrival: true },
  },
  {
    name: 'iPhone 15 Plus',
    slug: 'iphone-15-plus',
    model: 'iPhone 15 Plus',
    categorySlug: 'iphone',
    description:
      'A big 6.7" display and all-day battery life. Featuring the Dynamic Island, a 48MP Main camera, and USB-C.',
    highlights: ['6.7" Super Retina XDR display', 'Dynamic Island', '48MP Main camera', 'USB-C'],
    releaseYear: 2023,
    skuBase: 'IP15PL',
    storages: [
      { label: '128GB', price: 64990 },
      { label: '256GB', price: 71990 },
    ],
    colors: GEN15,
    flags: { isNewArrival: true },
  },
  {
    name: 'iPhone 15',
    slug: 'iphone-15',
    model: 'iPhone 15',
    categorySlug: 'iphone',
    description:
      'The Dynamic Island. A 48MP Main camera with 2x Telephoto. And USB-C. iPhone 15 has all of this in a durable, color-infused glass design.',
    highlights: ['6.1" Super Retina XDR display', 'Dynamic Island', '48MP Main camera', 'USB-C'],
    releaseYear: 2023,
    skuBase: 'IP15',
    storages: [
      { label: '128GB', price: 56990 },
      { label: '256GB', price: 63990 },
    ],
    colors: GEN15,
    flags: { isNewArrival: true, isBestSeller: true },
  },
  {
    name: 'iPhone 14 Pro Max',
    slug: 'iphone-14-pro-max',
    model: 'iPhone 14 Pro Max',
    categorySlug: 'iphone',
    description:
      'A magical new way to interact with iPhone via the Dynamic Island. A 48MP Main camera for stunning detail. And the Always-On display.',
    highlights: ['6.7" ProMotion display', 'A16 Bionic', 'Dynamic Island', '48MP Main camera'],
    releaseYear: 2022,
    skuBase: 'IP14PM',
    storages: [
      { label: '128GB', price: 76990 },
      { label: '256GB', price: 84990 },
    ],
    colors: [
      { name: 'Space Black', hex: '#31302F', code: 'SBK' },
      { name: 'Silver', hex: '#E3E4E5', code: 'SLV' },
      { name: 'Deep Purple', hex: '#5B517E', code: 'DPP' },
    ],
    flags: { isBestSeller: true },
  },
  {
    name: 'iPhone 14 Pro',
    slug: 'iphone-14-pro',
    model: 'iPhone 14 Pro',
    categorySlug: 'iphone',
    description:
      'The Dynamic Island, Always-On display, and a 48MP Main camera in a 6.1" Pro design powered by A16 Bionic.',
    highlights: ['6.1" ProMotion display', 'A16 Bionic', 'Dynamic Island', '48MP Main camera'],
    releaseYear: 2022,
    skuBase: 'IP14P',
    storages: [
      { label: '128GB', price: 69990 },
      { label: '256GB', price: 77990 },
    ],
    colors: [
      { name: 'Space Black', hex: '#31302F', code: 'SBK' },
      { name: 'Silver', hex: '#E3E4E5', code: 'SLV' },
      { name: 'Deep Purple', hex: '#5B517E', code: 'DPP' },
    ],
  },
  {
    name: 'iPhone 14',
    slug: 'iphone-14',
    model: 'iPhone 14',
    categorySlug: 'iphone',
    description:
      'A great 6.1" display, an advanced dual-camera system, and Crash Detection — a new safety feature — all powered by A15 Bionic.',
    highlights: ['6.1" Super Retina XDR display', 'A15 Bionic', 'Dual-camera system', 'Crash Detection'],
    releaseYear: 2022,
    skuBase: 'IP14',
    storages: [
      { label: '128GB', price: 51990 },
      { label: '256GB', price: 58990 },
    ],
    colors: GEN14,
    flags: { isBestSeller: true },
  },
  {
    name: 'iPhone 13',
    slug: 'iphone-13',
    model: 'iPhone 13',
    categorySlug: 'iphone',
    description:
      'A15 Bionic, a brighter Super Retina XDR display, and an advanced dual-camera system with Cinematic mode. A dependable classic.',
    highlights: ['6.1" Super Retina XDR display', 'A15 Bionic', 'Cinematic mode', 'Great battery life'],
    releaseYear: 2021,
    skuBase: 'IP13',
    storages: [
      { label: '128GB', price: 43990 },
      { label: '256GB', price: 49990 },
    ],
    colors: GEN13,
    discountPct: 10,
    flags: { isDeal: true },
  },
  {
    name: 'iPhone 13 mini',
    slug: 'iphone-13-mini',
    model: 'iPhone 13 mini',
    categorySlug: 'iphone',
    description:
      'All the power of iPhone 13 in a compact 5.4" design. A15 Bionic, Cinematic mode, and an advanced dual-camera system.',
    highlights: ['5.4" Super Retina XDR display', 'A15 Bionic', 'Compact design', 'Cinematic mode'],
    releaseYear: 2021,
    skuBase: 'IP13MINI',
    storages: [{ label: '128GB', price: 39990 }],
    colors: GEN13,
    discountPct: 12,
    flags: { isDeal: true },
  },
  {
    name: 'iPhone SE (3rd gen)',
    slug: 'iphone-se-3rd-gen',
    model: 'iPhone SE',
    categorySlug: 'iphone',
    description:
      'The most affordable iPhone with the powerful A15 Bionic chip, a beloved 4.7" design with Touch ID, and 5G speed.',
    highlights: ['4.7" Retina HD display', 'A15 Bionic', 'Touch ID', '5G'],
    releaseYear: 2022,
    skuBase: 'IPSE',
    storages: [
      { label: '64GB', price: 27990 },
      { label: '128GB', price: 32990 },
    ],
    colors: SE_COLORS,
    discountPct: 15,
    flags: { isDeal: true },
  },
];

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

// Deliberate stock states so the UI/inventory features have something to show.
const STOCK_OVERRIDES: Record<string, number> = {
  'IP13MINI-128-MID': 3, // low stock (below threshold of 5)
  'IPSE-64-STL': 0, // out of stock
};
// Seed lifetime sales so best-seller ranking is meaningful before any orders.
const INITIAL_SOLD: Record<string, number> = {
  'IP15PM-256-NT': 42,
  'IP15P-128-NT': 33,
  'IP15-128-BLK': 51,
  'IP14-128-MID': 60,
  'APP2-Standard-WHT': 88,
};

async function wipe() {
  // Delete in FK-safe order.
  await prisma.trackingHistory.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.inventoryTransaction.deleteMany();
  await prisma.order.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
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

  // --- Categories -----------------------------------------------------------
  const categoryDefs = [
    { name: 'iPhone', slug: 'iphone', description: 'The latest and greatest iPhone lineup.', position: 1 },
    { name: 'AirPods', slug: 'airpods', description: 'Wireless audio, redefined.', position: 2 },
    { name: 'Chargers & Cables', slug: 'chargers', description: 'Power up anywhere.', position: 3 },
    { name: 'Cases & Protection', slug: 'cases', description: 'Style meets protection.', position: 4 },
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
    { id: string; productName: string; color: string; storage: string; price: Prisma.Decimal }
  >();
  let productCount = 0;
  let variantCount = 0;

  for (const def of [...IPHONES, ...ACCESSORIES]) {
    const categoryId = categories.get(def.categorySlug);
    if (!categoryId) throw new Error(`Missing category for ${def.slug}`);

    const product = await prisma.product.create({
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

    for (const storage of def.storages) {
      for (const color of def.colors) {
        const storageCode = storage.label.replace('GB', '').replace('TB', 'T');
        const sku = `${def.skuBase}-${storageCode}-${color.code}`;
        const stock = STOCK_OVERRIDES[sku] ?? 25;
        const soldQty = INITIAL_SOLD[sku] ?? 0;

        const variant = await prisma.productVariant.create({
          data: {
            sku,
            storage: storage.label,
            color: color.name,
            colorHex: color.hex,
            price: money(storage.price),
            stock,
            soldQty,
            lowStockThreshold: 5,
            imageUrl: img(`${def.name} ${color.name}`),
            productId: product.id,
          },
        });
        variantCount++;
        variantsBySku.set(sku, {
          id: variant.id,
          productName: def.name,
          color: color.name,
          storage: storage.label,
          price: money(storage.price),
        });

        // The opening balance is itself a ledger entry: stock never appears
        // out of thin air.
        if (stock > 0) {
          await prisma.inventoryTransaction.create({
            data: {
              variantId: variant.id,
              type: InventoryTxnType.RESTOCK,
              previousStock: 0,
              quantityChanged: stock,
              newStock: stock,
              reason: 'Initial stock (seed)',
              adminId: admin.id,
            },
          });
        }
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
      lines: [{ sku: 'IP15PM-256-NT', qty: 1 }],
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
        { sku: 'IP15-128-BLK', qty: 1 },
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
      lines: [{ sku: 'IP14-128-MID', qty: 1 }],
      method: PaymentMethod.COD,
      paymentStatus: PaymentStatus.PENDING,
      orderStatus: OrderStatus.RECEIVED,
      shipmentStatus: ShipmentStatus.PENDING,
      deliveryFee: 150,
      trackingUpTo: OrderStatus.RECEIVED,
    },
  ];

  // Ordered milestones with coordinates for the simulated tracking timeline/map.
  const ROUTE: { status: OrderStatus; note: string; lat: number; lng: number }[] = [
    { status: OrderStatus.RECEIVED, note: 'Order placed and confirmed', lat: WAREHOUSE.lat, lng: WAREHOUSE.lng },
    { status: OrderStatus.PROCESSING, note: 'Preparing your order', lat: WAREHOUSE.lat, lng: WAREHOUSE.lng },
    { status: OrderStatus.PACKED, note: 'Packed at the warehouse', lat: WAREHOUSE.lat, lng: WAREHOUSE.lng },
    { status: OrderStatus.SHIPPED, note: 'Handed to iStore Express', lat: WAREHOUSE.lat, lng: WAREHOUSE.lng },
    { status: OrderStatus.IN_TRANSIT, note: 'Arrived at distribution hub', lat: HUB.lat, lng: HUB.lng },
    { status: OrderStatus.OUT_FOR_DELIVERY, note: 'Out for delivery', lat: DESTINATION.lat - 0.02, lng: DESTINATION.lng - 0.015 },
    { status: OrderStatus.DELIVERED, note: 'Delivered — thank you!', lat: DESTINATION.lat, lng: DESTINATION.lng },
  ];

  for (const so of sampleOrders) {
    await prisma.$transaction(async (tx) => {
      // Resolve lines against seeded variants, snapshotting details.
      const items = so.lines.map((line) => {
        const v = variantsBySku.get(line.sku);
        if (!v) throw new Error(`Sample order references unknown SKU ${line.sku}`);
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
      const milestones = ROUTE.slice(0, ROUTE.findIndex((r) => r.status === so.trackingUpTo) + 1);
      const last = milestones[milestones.length - 1]!;
      await tx.shipment.create({
        data: {
          orderId: order.id,
          status: so.shipmentStatus,
          courier: 'iStore Express',
          trackingCode: `IEX${yyyymmdd(so.placedAt)}${so.seq}`,
          originLat: WAREHOUSE.lat,
          originLng: WAREHOUSE.lng,
          destLat: DESTINATION.lat,
          destLng: DESTINATION.lng,
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

  // --- Notifications + audit log --------------------------------------------
  await prisma.notification.createMany({
    data: [
      {
        type: NotificationType.LOW_STOCK,
        level: NotificationLevel.WARNING,
        title: 'Low stock',
        message: 'iPhone 13 mini (128GB · Midnight) is running low (3 left).',
        entityType: 'ProductVariant',
      },
      {
        type: NotificationType.OUT_OF_STOCK,
        level: NotificationLevel.ERROR,
        title: 'Out of stock',
        message: 'iPhone SE (64GB · Starlight) is out of stock.',
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
      meta: { productCount, variantCount, orders: sampleOrders.length },
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
