// ============================================================================
//  Shared demo / presentation definitions.
//
//  Imported by BOTH:
//    • prisma/seed.ts       — destructive rebuild, local / fresh databases only
//    • prisma/demo-data.ts  — additive + idempotent, safe against the live DB
//  so the two can never disagree about what the demo data actually IS.
//
//  Scope: branches, the accessory def shape, and the demo APPLICATIONS that keep
//  the back-office lists from being empty (trade-ins, installment plans). The
//  product catalog itself is real and lives in ./catalog-defs — nothing here
//  creates a phone. All imagery is a placeholder — no copyrighted product photos.
// ============================================================================
import { ProductCondition, TradeInStatus, InstallmentStatus } from '@prisma/client';

/** placehold.co image, on-brand Sunset Glass colors, clearly a placeholder. */
export const img = (text: string) =>
  `https://placehold.co/1000x1000/FFF9F4/F4590A?text=${encodeURIComponent(text)}`;

export type Color = { name: string; hex: string; code: string };
export type StorageDef = { label: string; price: number };

/**
 * An accessory listing: one price per size, cross-multiplied with colours. The
 * phones and iPads use `CatalogProductDef` in ./catalog-defs instead, because a
 * phone row carries a condition tier and a second (installment) price.
 */
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

// ── Demo applications (so the back-office lists aren't empty) ───────────────
//
// These are the ONLY demo records left: the catalog, its prices and its
// installment opt-ins are real and come from ./catalog-defs. Nothing here
// creates or re-creates a product, so `demo:data` can never put a dummy phone
// back on the live store.

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
  /** Which catalog variant the customer applied for — a real SKU from ./catalog-defs. */
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
// `computeSchedule` — the same function the API uses at apply time — against the
// variant's INSTALLMENT base price, not its cash price.
export const INSTALLMENT_DEMOS: InstallmentDemo[] = [
  {
    seq: 1,
    daysAgo: 3,
    sku: 'IP15PM-256-STD',
    customerName: 'Grace Villanueva',
    customerEmail: 'grace.villanueva@example.com',
    customerPhone: '+639173334455',
    branchSlug: 'passi',
    // A 9-month term on this principal doesn't divide evenly — a deliberate case
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
    sku: 'IP12-128-PRE',
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
