// ============================================================================
//  Shared demo / presentation definitions.
//
//  Imported by BOTH:
//    • prisma/seed.ts       — destructive rebuild, local / fresh databases only
//    • prisma/demo-data.ts  — additive + idempotent, safe against the live DB
//  so the two can never disagree about what the demo data actually IS.
//
//  Everything in this file is DEMO data for presentations. The owner replaces it
//  with real stock from Admin → Products (see docs/ADD-YOUR-PRODUCTS.md). All
//  imagery is a placeholder — no copyrighted product photos.
// ============================================================================
import { ProductCondition, TradeInStatus, InstallmentStatus } from '@prisma/client';

/** placehold.co image, on-brand Sunset Glass colors, clearly a placeholder. */
export const img = (text: string) =>
  `https://placehold.co/1000x1000/FFF9F4/F4590A?text=${encodeURIComponent(text)}`;

export type Color = { name: string; hex: string; code: string };
export type StorageDef = { label: string; price: number };

export type ProductDef = {
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
  /** Per-variant "Low" warning threshold. Defaults to 5 — one-off used stock wants 1. */
  lowStockThreshold?: number;
  /**
   * Applied to every variant this def generates. Used for second-hand listings:
   * the condition/battery/note here is the per-UNIT truth, while the listing-level
   * `flags.isPreOwned` is what drives the storefront badge and Pre-loved rail.
   */
  unit?: { condition: ProductCondition; batteryHealth?: number; conditionNote?: string };
  flags?: Partial<{
    isFeatured: boolean;
    isNewArrival: boolean;
    isBestSeller: boolean;
    isDeal: boolean;
    isPreOwned: boolean;
  }>;
};

/** SKU convention used throughout the catalog: SKUBASE-STORAGE-COLORCODE. */
export function skuFor(skuBase: string, storageLabel: string, colorCode: string): string {
  return `${skuBase}-${storageLabel.replace('GB', '').replace('TB', 'T')}-${colorCode}`;
}

// ── Branches ────────────────────────────────────────────────────────────────
//
// JLP Gadgetz Center's three locations. Stock is GLOBAL — a branch is a
// customer-selectable pickup / contact point, never a separate inventory.
//
// Only Passi has a street address we actually know, so it's the only one with
// `addressLine`; the others carry city/province only. `hours` and lat/lng are
// deliberately left unset rather than invented — the owner fills those in from
// Admin → Branches, which is also where per-branch phone/email live.
export const BRANCH_DEFS = [
  {
    name: 'Passi Branch',
    slug: 'passi',
    city: 'Passi City',
    province: 'Iloilo',
    addressLine: 'Dorillo Street, Passi City, Passi, Philippines, 5037',
    phone: '0930 119 7407',
    email: 'jlpgadgetzcenter@gmail.com',
    position: 1,
    isDefault: true, // pre-selected in pickers
  },
  { name: 'Kalibo Branch', slug: 'kalibo', city: 'Kalibo', province: 'Aklan', position: 2 },
  { name: 'Sara Branch', slug: 'sara', city: 'Sara', province: 'Iloilo', position: 3 },
];

// ── Installment opt-ins ─────────────────────────────────────────────────────
//
// Product slug → smallest down payment staff will accept, as a percent of price.
// Presence in this table is what flips `installmentAvailable`. The monthly amount
// is ALWAYS price ÷ term, computed server-side — this percentage is not interest,
// a service fee, or a financing charge, and there is none of either anywhere.
//
// Accessories are deliberately excluded: a ₱1,190 charger on a 12-month plan is
// not a real offer.
export const INSTALLMENT_MIN_DOWN_PCT: Record<string, number> = {
  'iphone-15-pro-max': 20,
  'iphone-15': 10,
  'iphone-14': 0,
  'iphone-13': 0,
  'iphone-12-pre-loved': 20,
};

// ── Pre-loved demo listing ──────────────────────────────────────────────────
//
// Demonstrates both new features at once: the listing-level "Pre-loved" flag and
// the installment application. Every unit detail is DEMO data.
export const PRE_LOVED_DEMO: ProductDef = {
  name: 'iPhone 12 (Pre-loved)',
  slug: 'iphone-12-pre-loved',
  model: 'iPhone 12',
  categorySlug: 'iphone',
  description:
    'A second-hand iPhone 12, tested and cleaned in store before it goes on the shelf. Every unit is sold as-is with its condition and battery health written on the listing, so you know exactly what you are getting. Ask any branch to see the actual unit before you pay.',
  highlights: [
    '6.1" Super Retina XDR display',
    'A14 Bionic',
    'Fully tested in store',
    'Condition and battery health disclosed',
  ],
  releaseYear: 2020,
  skuBase: 'IP12PL',
  // Second-hand stock is one-off: 1 unit left is normal, not a restock alarm.
  lowStockThreshold: 1,
  storages: [
    { label: '64GB', price: 19990 },
    { label: '128GB', price: 23990 },
  ],
  colors: [
    { name: 'Black', hex: '#1F2020', code: 'BLK' },
    { name: 'Blue', hex: '#1E4C6B', code: 'BLU' },
  ],
  unit: {
    condition: ProductCondition.PREOWNED,
    batteryHealth: 89,
    conditionNote:
      'Light hairline scratches on the frame, screen is clean. Comes with a charging cable only — no original box. Sold as-is; shop-tested before release.',
  },
  flags: { isPreOwned: true },
};

/** On-hand units per pre-loved SKU — second-hand stock is one-off, never 25. */
export const PRE_LOVED_STOCK: Record<string, number> = {
  'IP12PL-64-BLK': 1,
  'IP12PL-64-BLU': 2,
  'IP12PL-128-BLK': 2,
  'IP12PL-128-BLU': 1,
};

// ── Demo applications (so the back-office lists aren't empty) ───────────────

export type TradeInDemo = {
  /** Sequence within its submission day — feeds the TRD-YYYYMMDD-#### reference. */
  seq: number;
  /** Days before "now" the application came in. */
  daysAgo: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deviceBrand: string;
  deviceModel: string;
  storage: string;
  color: string;
  condition: ProductCondition;
  batteryHealth: number;
  hasBox: boolean;
  hasCharger: boolean;
  issues: string | null;
  branchSlug: string;
  status: TradeInStatus;
  /** Staff-entered offer. Null while the application is still unpriced. */
  quotedValue: number | null;
  staffNotes: string | null;
};

// Valuations below are DEMO figures typed the way a staff member would type them
// on inspection — nothing in this feature computes an offer.
export const TRADE_IN_DEMOS: TradeInDemo[] = [
  {
    seq: 1,
    daysAgo: 2,
    customerName: 'Rowena Bautista',
    customerEmail: 'rowena.bautista@example.com',
    customerPhone: '+639171112233',
    deviceBrand: 'Apple',
    deviceModel: 'iPhone 11',
    storage: '128GB',
    color: 'Black',
    condition: ProductCondition.PREOWNED,
    batteryHealth: 82,
    hasBox: true,
    hasCharger: true,
    issues: 'Small chip on the bottom-left corner of the screen. Everything else works.',
    branchSlug: 'passi',
    status: TradeInStatus.SUBMITTED,
    quotedValue: null,
    staffNotes: null,
  },
  {
    seq: 2,
    daysAgo: 5,
    customerName: 'Dennis Alcantara',
    customerEmail: 'dennis.alcantara@example.com',
    customerPhone: '+639182223344',
    deviceBrand: 'Samsung',
    deviceModel: 'Galaxy S21',
    storage: '256GB',
    color: 'Phantom Gray',
    condition: ProductCondition.PREOWNED,
    batteryHealth: 88,
    hasBox: false,
    hasCharger: true,
    issues: null,
    branchSlug: 'kalibo',
    status: TradeInStatus.QUOTED,
    quotedValue: 11500,
    staffNotes: 'Inspected in store — clean unit, no box. Offer valid for 7 days.',
  },
];

export type InstallmentDemo = {
  /** Sequence within its application day — feeds the INS-YYYYMMDD-#### reference. */
  seq: number;
  daysAgo: number;
  /** Which catalog variant the customer applied for. */
  sku: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  branchSlug: string;
  termMonths: number;
  downPayment: number;
  status: InstallmentStatus;
  /** How many schedule rows are already settled (demo payment history). */
  paidRows: number;
  staffNotes: string | null;
};

// Plan money is never hand-written: both consumers run these through
// `computeSchedule` — the same function the API uses at apply time.
export const INSTALLMENT_DEMOS: InstallmentDemo[] = [
  {
    seq: 1,
    daysAgo: 3,
    sku: 'IP15PM-256-NT',
    customerName: 'Grace Villanueva',
    customerEmail: 'grace.villanueva@example.com',
    customerPhone: '+639173334455',
    branchSlug: 'passi',
    // 9 months on a ₱69,990 principal doesn't divide evenly — a deliberate case
    // that shows the final schedule row absorbing the rounding remainder.
    termMonths: 9,
    downPayment: 20000,
    status: InstallmentStatus.PENDING,
    paidRows: 0,
    staffNotes: null,
  },
  {
    seq: 2,
    daysAgo: 40,
    sku: 'IP12PL-128-BLK',
    customerName: 'Mark Anthony Salazar',
    customerEmail: 'mark.salazar@example.com',
    customerPhone: '+639184445566',
    branchSlug: 'sara',
    termMonths: 6,
    downPayment: 5000,
    status: InstallmentStatus.ACTIVE,
    paidRows: 1, // month 1 already recorded → shows the payment ledger in use
    staffNotes: 'Approved in store. Down payment paid in cash on application day.',
  },
];
