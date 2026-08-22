// ============================================================================
//  JLP Gadgetz Center — the REAL catalog.
//
//  This is the shop's own price list, not demo data. Every row below came from
//  the owner's sheet: a model, a storage size, a condition tier, a CASH price
//  and a separate, higher INSTALLMENT BASE price.
//
//  Imported by BOTH:
//    • prisma/seed.ts         — destructive rebuild, local / fresh databases only
//    • prisma/catalog-sync.ts — additive + declarative, safe against the live DB
//  so the two can never disagree about what the catalog actually IS.
//
//  Accessories are NOT here: they live in seed.ts's own ACCESSORIES array and
//  are deliberately untouched by anything in this file.
//
//  Two prices, two jobs — see ProductVariant in schema.prisma:
//    price            → cash. Cart, checkout, orders. Never the installment base.
//    installmentPrice → what the monthly schedule divides. NULL = use `price`.
//
//  Imagery is a placeholder (`img()`); the owner replaces it with photos of the
//  actual units from Admin → Products → Images.
// ============================================================================
import { ProductCondition, ProductStatus } from '@prisma/client';
import { skuFor } from './demo-defs';

/** The three tiers the price list uses. OPEN_BOX / REFURBISHED stay available in
 *  admin for one-off units, but nothing in the sheet is graded that way. */
export type CatalogCondition = Extract<ProductCondition, 'NEW' | 'STANDARD' | 'PREOWNED'>;

/** One sellable row of the price list. */
export type CatalogVariantDef = {
  /** Customer-facing size label, e.g. "128GB" or "64GB Wi-Fi + Cellular". */
  storage: string;
  /** SKU segment override for labels that aren't a bare size (iPad mini only). */
  skuStorage?: string;
  condition: CatalogCondition;
  /** Cash price → ProductVariant.price. 0 = not priced on the sheet yet. */
  cash: number;
  /** Installment base → ProductVariant.installmentPrice. Null = finance at cash. */
  installment: number | null;
};

export type CatalogProductDef = {
  name: string;
  slug: string;
  model: string;
  categorySlug: string;
  description: string;
  highlights: string[];
  releaseYear: number;
  skuBase: string;
  /** One entry per row of the sheet — storage × condition, each with its prices. */
  variants: CatalogVariantDef[];
  /** Defaults to ACTIVE. DRAFT hides the listing until the owner prices it. */
  status?: ProductStatus;
  /** Per-variant "Low" warning threshold. Defaults by tier — see LOW_STOCK_THRESHOLD. */
  lowStockThreshold?: number;
  /** Smallest down payment staff will accept, % of the installment base. */
  installmentMinDownPct?: number;
  flags?: Partial<{
    isFeatured: boolean;
    isNewArrival: boolean;
    isBestSeller: boolean;
    isDeal: boolean;
    isPreOwned: boolean;
  }>;
};

// ── Conventions shared by both loaders ──────────────────────────────────────

/**
 * SKU third segment. The sheet has no colours, so the slot that holds a colour
 * code for accessories (`SILC-1S-BLK`) carries the condition tier instead:
 * `IP14-128-STD` and `IP14-128-NEW` are the same phone at two grades. This also
 * means a real SKU can never collide with a retired demo SKU, which always ends
 * in a colour code.
 */
export const CONDITION_SKU_CODE: Record<CatalogCondition, string> = {
  NEW: 'NEW',
  STANDARD: 'STD',
  PREOWNED: 'PRE',
};

/**
 * The sheet doesn't say which colours are in stock, so we don't invent any: one
 * neutral colour per variant, no swatch hex. The storefront hides the colour
 * picker when a product has a single colour. Rename it per unit in admin.
 */
export const PLACEHOLDER_COLOR = { name: 'Assorted', hex: null };

/** Opening stock by tier — second-hand stock is one-off, never a shelf of 25. */
export const OPENING_STOCK: Record<CatalogCondition, number> = {
  PREOWNED: 1,
  STANDARD: 3,
  NEW: 3,
};

/** "Low" flag by tier. Kept under OPENING_STOCK so a full shelf isn't "Low". */
export const LOW_STOCK_THRESHOLD: Record<CatalogCondition, number> = {
  PREOWNED: 1,
  STANDARD: 2,
  NEW: 2,
};

/**
 * Minimum down payment, % of the installment base. The sheet carries no
 * down-payment terms, so every listing ships with the same conservative floor —
 * one field per product in Admin → Details → Installment to change. It is NOT
 * interest or a fee: the monthly amount is always principal ÷ term.
 */
export const DEFAULT_MIN_DOWN_PCT = 20;

/**
 * Shown to customers on every non-sealed unit. Deliberately says what we know
 * (it was tested in store) and not what we don't — battery health is left blank
 * rather than guessed, and staff fill it in per unit.
 */
export const CONDITION_NOTE: Record<CatalogCondition, string | null> = {
  NEW: null,
  STANDARD: 'Shop-standard unit: opened and fully tested in store, not sold sealed.',
  PREOWNED:
    'Second-hand unit, tested and cleaned in store. Battery health and cosmetic condition are confirmed on the actual unit before you pay.',
};

/** Full SKU for a catalog row: SKUBASE-STORAGE-CONDITIONCODE. */
export const catalogSku = (def: CatalogProductDef, v: CatalogVariantDef): string =>
  skuFor(def.skuBase, v.skuStorage ?? v.storage, CONDITION_SKU_CODE[v.condition]);

/** A row with no price on the sheet yet — created, but never sellable. */
export const isUnpriced = (v: CatalogVariantDef): boolean => v.cash <= 0;

/** The "from" price on the card: the cheapest cash price actually on the sheet. */
export const basePriceOf = (def: CatalogProductDef): number => {
  const priced = def.variants.filter((v) => !isUnpriced(v)).map((v) => v.cash);
  return priced.length ? Math.min(...priced) : 0;
};

export const openingStockOf = (def: CatalogProductDef, v: CatalogVariantDef): number =>
  isUnpriced(v) || def.status === ProductStatus.DRAFT ? 0 : OPENING_STOCK[v.condition];

export const lowStockThresholdOf = (def: CatalogProductDef, v: CatalogVariantDef): number =>
  def.lowStockThreshold ?? LOW_STOCK_THRESHOLD[v.condition];

// ── Product copy ────────────────────────────────────────────────────────────
//
// Written for JLP, not lifted from Apple's marketing. Each listing is one line
// about the phone plus the same honest promise about how that tier is sold.

const SOLD_AS: Record<CatalogCondition, string> = {
  PREOWNED:
    'Second-hand and sold as-is: every unit is tested and cleaned in store first, and you see the actual battery health and cosmetic condition before you pay.',
  STANDARD:
    'Shop-standard unit — opened and fully tested in store rather than sold sealed, which is why it costs less than brand new.',
  NEW: 'Brand new and sealed, complete with its box and included accessories.',
};

/** Second and later tiers on a mixed listing read as an add-on, not a restatement. */
const ALSO_STOCKED: Partial<Record<CatalogCondition, string>> = {
  NEW: 'Brand new, still-sealed units are stocked here too — choose “Brand new” under Condition for that price.',
};

const describe = (blurb: string, tiers: CatalogCondition[]): string =>
  [blurb, ...tiers.map((t, i) => (i === 0 ? SOLD_AS[t] : (ALSO_STOCKED[t] ?? SOLD_AS[t])))].join(' ');

// ── Row builders, so the defs below read like the owner's sheet ─────────────

const pre = (storage: string, cash: number, installment: number): CatalogVariantDef => ({
  storage,
  condition: 'PREOWNED',
  cash,
  installment,
});
const std = (storage: string, cash: number, installment: number): CatalogVariantDef => ({
  storage,
  condition: 'STANDARD',
  cash,
  installment,
});
const sealed = (storage: string, cash: number, installment: number): CatalogVariantDef => ({
  storage,
  condition: 'NEW',
  cash,
  installment,
});

// ── Categories this catalog needs ───────────────────────────────────────────
//
// `iphone` already exists everywhere; `ipad` is new (an iPad is not a phone, and
// filing it under iPhone would be wrong). catalog-sync appends a missing
// category after the last existing one so no live row has to be renumbered.
export const CATALOG_CATEGORY_DEFS = [
  { name: 'iPhone', slug: 'iphone', description: 'Brand new, standard and pre-owned iPhone units.', position: 1 },
  { name: 'iPad', slug: 'ipad', description: 'iPad and iPad mini, Wi-Fi and Cellular.', position: 2 },
];

/**
 * Demo listings with no counterpart in the real price list. catalog-sync
 * ARCHIVES these (hidden from the store, history kept) — it never deletes, and
 * the API refuses a hard delete for anything with stock or sales history anyway.
 * The other 8 demo iPhones share a slug with a real model and are rewritten in
 * place instead, which is why they're absent here.
 */
export const RETIRED_DEMO_SLUGS = ['iphone-13-mini', 'iphone-se-3rd-gen', 'iphone-12-pre-loved'];

/**
 * Every variant the old demo seed created, listed EXACTLY — `storages × colour
 * codes` per SKU base, the same cross-product the retired `IPHONES` defs used.
 * catalog-sync deactivates these and zeroes their stock through the ledger.
 *
 * Enumerated rather than inferred ("any variant not in the real catalog") on
 * purpose: a variant the owner adds by hand in admin must never be caught by a
 * cleanup step, whatever SKU they choose to type.
 */
export const RETIRED_DEMO_VARIANTS: { skuBase: string; storages: string[]; colorCodes: string[] }[] = [
  { skuBase: 'IP15PM', storages: ['256GB', '512GB', '1TB'], colorCodes: ['NT', 'BT', 'WT', 'KT'] },
  { skuBase: 'IP15P', storages: ['128GB', '256GB', '512GB'], colorCodes: ['NT', 'BT', 'WT', 'KT'] },
  { skuBase: 'IP15PL', storages: ['128GB', '256GB'], colorCodes: ['BLK', 'BLU', 'GRN', 'PNK'] },
  { skuBase: 'IP15', storages: ['128GB', '256GB'], colorCodes: ['BLK', 'BLU', 'GRN', 'PNK'] },
  { skuBase: 'IP14PM', storages: ['128GB', '256GB'], colorCodes: ['SBK', 'SLV', 'DPP'] },
  { skuBase: 'IP14P', storages: ['128GB', '256GB'], colorCodes: ['SBK', 'SLV', 'DPP'] },
  { skuBase: 'IP14', storages: ['128GB', '256GB'], colorCodes: ['MID', 'STL', 'PRP', 'RED'] },
  { skuBase: 'IP13', storages: ['128GB', '256GB'], colorCodes: ['MID', 'STL', 'BLU', 'PNK'] },
  // The three below belong to products that get ARCHIVED, but their stock is
  // still zeroed so admin's on-hand totals aren't inflated by phantom units.
  { skuBase: 'IP13MINI', storages: ['128GB'], colorCodes: ['MID', 'STL', 'BLU', 'PNK'] },
  { skuBase: 'IPSE', storages: ['64GB', '128GB'], colorCodes: ['MID', 'STL', 'RED'] },
  { skuBase: 'IP12PL', storages: ['64GB', '128GB'], colorCodes: ['BLK', 'BLU'] },
];

/** The 82 demo SKUs above, expanded. */
export const retiredDemoSkus = (): string[] =>
  RETIRED_DEMO_VARIANTS.flatMap((d) => d.storages.flatMap((s) => d.colorCodes.map((c) => skuFor(d.skuBase, s, c))));

// ============================================================================
//  THE CATALOG — 26 listings, 48 variants.
//
//  Prices are exactly as supplied: `cash / installment base`, in pesos.
// ============================================================================

// ── Pre-owned ───────────────────────────────────────────────────────────────
// Second-hand only, so the listing-level Pre-owned flag is on: badge on the
// card, a place in the homepage Pre-owned row, and the store's Pre-owned filter.

const PRE_OWNED: CatalogProductDef[] = [
  {
    name: 'iPhone 11',
    slug: 'iphone-11',
    model: 'iPhone 11',
    categorySlug: 'iphone',
    description: describe(
      'The iPhone that still does everything most people need, at the friendliest price in the shop.',
      ['PREOWNED'],
    ),
    highlights: ['6.1" Liquid Retina display', 'A13 Bionic chip', 'Dual 12MP wide + ultra-wide camera'],
    releaseYear: 2019,
    skuBase: 'IP11',
    flags: { isPreOwned: true, isBestSeller: true },
    variants: [pre('128GB', 13990, 16990)],
  },
  {
    name: 'iPhone 11 Pro',
    slug: 'iphone-11-pro',
    model: 'iPhone 11 Pro',
    categorySlug: 'iphone',
    description: describe(
      'The compact Pro of its generation, with the triple-camera system and the sharper Super Retina XDR screen.',
      ['PREOWNED'],
    ),
    highlights: ['5.8" Super Retina XDR display', 'A13 Bionic chip', 'Triple 12MP camera system'],
    releaseYear: 2019,
    skuBase: 'IP11P',
    // The sheet lists this model with no price yet, so it stays a DRAFT: visible
    // in admin, hidden from the store. Set the two prices and switch Status to
    // Active — nothing else is needed.
    status: ProductStatus.DRAFT,
    flags: { isPreOwned: true },
    variants: [{ storage: '256GB', condition: 'PREOWNED', cash: 0, installment: null }],
  },
  {
    name: 'iPhone 11 Pro Max',
    slug: 'iphone-11-pro-max',
    model: 'iPhone 11 Pro Max',
    categorySlug: 'iphone',
    description: describe(
      'The big-screen Pro of the 11 generation — still one of the longest-lasting batteries Apple has shipped.',
      ['PREOWNED'],
    ),
    highlights: ['6.5" Super Retina XDR display', 'A13 Bionic chip', 'Triple 12MP camera system'],
    releaseYear: 2019,
    skuBase: 'IP11PM',
    flags: { isPreOwned: true },
    variants: [pre('256GB', 19990, 22990)],
  },
  {
    name: 'iPhone 12',
    slug: 'iphone-12',
    model: 'iPhone 12',
    categorySlug: 'iphone',
    description: describe(
      'The first 5G iPhone, with the flat-edge design and the brighter OLED screen that came with it.',
      ['PREOWNED'],
    ),
    highlights: ['6.1" Super Retina XDR display', 'A14 Bionic chip', '5G', 'MagSafe charging'],
    releaseYear: 2020,
    skuBase: 'IP12',
    flags: { isPreOwned: true, isBestSeller: true },
    variants: [pre('128GB', 17990, 20990), pre('256GB', 18990, 21990)],
  },
  {
    name: 'iPhone 12 Pro',
    slug: 'iphone-12-pro',
    model: 'iPhone 12 Pro',
    categorySlug: 'iphone',
    description: describe(
      'Stainless-steel Pro build with the LiDAR-assisted triple camera, in the easy-to-hold 6.1" size.',
      ['PREOWNED'],
    ),
    highlights: ['6.1" Super Retina XDR display', 'A14 Bionic chip', 'Triple camera + LiDAR scanner'],
    releaseYear: 2020,
    skuBase: 'IP12P',
    flags: { isPreOwned: true },
    variants: [pre('128GB', 19990, 22990), pre('256GB', 20990, 23990)],
  },
  {
    name: 'iPhone 12 Pro Max',
    slug: 'iphone-12-pro-max',
    model: 'iPhone 12 Pro Max',
    categorySlug: 'iphone',
    description: describe(
      'The largest 12-series Pro, with the biggest sensor of its generation for low-light shots.',
      ['PREOWNED'],
    ),
    highlights: ['6.7" Super Retina XDR display', 'A14 Bionic chip', 'Triple camera + LiDAR scanner'],
    releaseYear: 2020,
    skuBase: 'IP12PM',
    flags: { isPreOwned: true },
    variants: [pre('128GB', 22990, 25990), pre('256GB', 24990, 27990)],
  },
  {
    name: 'iPhone 13',
    slug: 'iphone-13',
    model: 'iPhone 13',
    categorySlug: 'iphone',
    description: describe(
      'The sweet spot of the line-up: a noticeably longer battery than the 12 and Cinematic mode video.',
      ['PREOWNED'],
    ),
    highlights: ['6.1" Super Retina XDR display', 'A15 Bionic chip', 'Dual 12MP camera', 'Cinematic mode'],
    releaseYear: 2021,
    skuBase: 'IP13',
    flags: { isPreOwned: true, isBestSeller: true, isFeatured: true },
    variants: [pre('128GB', 19990, 23990), pre('256GB', 21990, 25990)],
  },
  {
    name: 'iPhone 13 Pro',
    slug: 'iphone-13-pro',
    model: 'iPhone 13 Pro',
    categorySlug: 'iphone',
    description: describe(
      'The first Pro with a 120Hz ProMotion screen, plus the 3x telephoto and macro camera.',
      ['PREOWNED'],
    ),
    highlights: [
      '6.1" Super Retina XDR with ProMotion',
      'A15 Bionic chip',
      'Triple camera + LiDAR scanner',
      'Macro photography',
    ],
    releaseYear: 2021,
    skuBase: 'IP13P',
    flags: { isPreOwned: true },
    variants: [pre('128GB', 26990, 29990), pre('256GB', 29990, 32990)],
  },
];

// ── Standard & brand new ────────────────────────────────────────────────────
// The Pre-owned flag stays OFF here: on a listing that also sells sealed units,
// flagging the whole page second-hand would mislabel the brand-new ones. The
// per-variant Condition does the talking instead.

const STANDARD_AND_NEW: CatalogProductDef[] = [
  {
    name: 'iPhone 13 Pro Max',
    slug: 'iphone-13-pro-max',
    model: 'iPhone 13 Pro Max',
    categorySlug: 'iphone',
    description: describe('The biggest 13-series Pro, with ProMotion and the longest battery of its year.', [
      'STANDARD',
    ]),
    highlights: [
      '6.7" Super Retina XDR with ProMotion',
      'A15 Bionic chip',
      'Triple camera + LiDAR scanner',
      'Macro photography',
    ],
    releaseYear: 2021,
    skuBase: 'IP13PM',
    variants: [std('128GB', 31990, 34990), std('256GB', 34990, 37990)],
  },
  {
    name: 'iPhone 14',
    slug: 'iphone-14',
    model: 'iPhone 14',
    categorySlug: 'iphone',
    description: describe('A dependable everyday iPhone with better low-light photos and Crash Detection.', [
      'STANDARD',
      'NEW',
    ]),
    highlights: ['6.1" Super Retina XDR display', 'A15 Bionic (5-core GPU)', 'Photonic Engine', 'Crash Detection'],
    releaseYear: 2022,
    skuBase: 'IP14',
    flags: { isBestSeller: true },
    variants: [std('128GB', 24990, 27990), std('256GB', 27990, 30990), sealed('128GB', 33990, 38990)],
  },
  {
    name: 'iPhone 14 Plus',
    slug: 'iphone-14-plus',
    model: 'iPhone 14 Plus',
    categorySlug: 'iphone',
    description: describe('Big-screen iPhone 14 without the Pro price — and the bigger battery that comes with it.', [
      'STANDARD',
    ]),
    highlights: ['6.7" Super Retina XDR display', 'A15 Bionic (5-core GPU)', 'Photonic Engine', 'Crash Detection'],
    releaseYear: 2022,
    skuBase: 'IP14PL',
    variants: [std('128GB', 29990, 32990)],
  },
  {
    name: 'iPhone 14 Pro',
    slug: 'iphone-14-pro',
    model: 'iPhone 14 Pro',
    categorySlug: 'iphone',
    description: describe(
      'The generation that introduced the Dynamic Island, the always-on display and the 48MP main camera.',
      ['STANDARD'],
    ),
    highlights: [
      '6.1" Super Retina XDR with ProMotion',
      'Dynamic Island + always-on display',
      'A16 Bionic chip',
      '48MP main camera',
    ],
    releaseYear: 2022,
    skuBase: 'IP14P',
    variants: [std('128GB', 31990, 34990), std('256GB', 34990, 37990)],
  },
  {
    name: 'iPhone 14 Pro Max',
    slug: 'iphone-14-pro-max',
    model: 'iPhone 14 Pro Max',
    categorySlug: 'iphone',
    description: describe('Everything the 14 Pro does, on the largest screen and battery of its generation.', [
      'STANDARD',
    ]),
    highlights: [
      '6.7" Super Retina XDR with ProMotion',
      'Dynamic Island + always-on display',
      'A16 Bionic chip',
      '48MP main camera',
    ],
    releaseYear: 2022,
    skuBase: 'IP14PM',
    variants: [std('128GB', 36990, 39990), std('256GB', 38990, 41990)],
  },
  {
    name: 'iPhone 15',
    slug: 'iphone-15',
    model: 'iPhone 15',
    categorySlug: 'iphone',
    description: describe(
      'The first non-Pro iPhone with USB-C, the Dynamic Island and a 48MP main camera — a big jump from the 14.',
      ['STANDARD', 'NEW'],
    ),
    highlights: [
      '6.1" Super Retina XDR display',
      'Dynamic Island',
      'A16 Bionic chip',
      '48MP main camera',
      'USB-C charging',
    ],
    releaseYear: 2023,
    skuBase: 'IP15',
    flags: { isBestSeller: true, isFeatured: true },
    variants: [std('128GB', 29990, 32990), std('256GB', 33990, 36990), sealed('128GB', 38990, 44990)],
  },
  {
    name: 'iPhone 15 Plus',
    slug: 'iphone-15-plus',
    model: 'iPhone 15 Plus',
    categorySlug: 'iphone',
    description: describe('The 15 in its big-screen size, with the battery life to match.', ['STANDARD']),
    highlights: [
      '6.7" Super Retina XDR display',
      'Dynamic Island',
      'A16 Bionic chip',
      '48MP main camera',
      'USB-C charging',
    ],
    releaseYear: 2023,
    skuBase: 'IP15PL',
    variants: [std('128GB', 33990, 36990), std('256GB', 36990, 39990)],
  },
  {
    name: 'iPhone 15 Pro',
    slug: 'iphone-15-pro',
    model: 'iPhone 15 Pro',
    categorySlug: 'iphone',
    description: describe(
      'The first titanium Pro — lighter in the hand, with the Action button and a much faster chip.',
      ['STANDARD'],
    ),
    highlights: [
      '6.1" Super Retina XDR with ProMotion',
      'Titanium design',
      'A17 Pro chip',
      'Action button',
      'USB-C (USB 3 speeds)',
    ],
    releaseYear: 2023,
    skuBase: 'IP15P',
    variants: [std('128GB', 40990, 43990), std('256GB', 42990, 45990)],
  },
  {
    name: 'iPhone 15 Pro Max',
    slug: 'iphone-15-pro-max',
    model: 'iPhone 15 Pro Max',
    categorySlug: 'iphone',
    description: describe('The titanium Pro Max, and the only 15 with the 5x tetraprism telephoto camera.', [
      'STANDARD',
    ]),
    highlights: [
      '6.7" Super Retina XDR with ProMotion',
      'Titanium design',
      'A17 Pro chip',
      '5x telephoto camera',
      'USB-C (USB 3 speeds)',
    ],
    releaseYear: 2023,
    skuBase: 'IP15PM',
    variants: [std('256GB', 45990, 48990), std('512GB', 48990, 52990)],
  },
  {
    name: 'iPhone 16',
    slug: 'iphone-16',
    model: 'iPhone 16',
    categorySlug: 'iphone',
    description: describe('A16-era iPhone brought up to date: Camera Control, the Action button and the A18 chip.', [
      'STANDARD',
      'NEW',
    ]),
    highlights: [
      '6.1" Super Retina XDR display',
      'A18 chip',
      '48MP Fusion camera',
      'Camera Control',
      'Action button',
    ],
    releaseYear: 2024,
    skuBase: 'IP16',
    flags: { isBestSeller: true, isFeatured: true },
    variants: [std('128GB', 36990, 39990), std('256GB', 38990, 41990), sealed('128GB', 48990, 52990)],
  },
  {
    name: 'iPhone 16 Plus',
    slug: 'iphone-16-plus',
    model: 'iPhone 16 Plus',
    categorySlug: 'iphone',
    description: describe('The 16 in the larger size, for the biggest battery outside the Pro Max.', [
      'STANDARD',
      'NEW',
    ]),
    highlights: [
      '6.7" Super Retina XDR display',
      'A18 chip',
      '48MP Fusion camera',
      'Camera Control',
      'Action button',
    ],
    releaseYear: 2024,
    skuBase: 'IP16PL',
    variants: [std('128GB', 43990, 47990), std('256GB', 45990, 48990), sealed('128GB', 56990, 59990)],
  },
  {
    name: 'iPhone 16 Pro',
    slug: 'iphone-16-pro',
    model: 'iPhone 16 Pro',
    categorySlug: 'iphone',
    description: describe('A slightly bigger Pro screen in the same footprint, with the 5x telephoto now standard.', [
      'STANDARD',
    ]),
    highlights: [
      '6.3" Super Retina XDR with ProMotion',
      'Titanium design',
      'A18 Pro chip',
      '48MP Fusion + 5x telephoto',
      'Camera Control',
    ],
    releaseYear: 2024,
    skuBase: 'IP16P',
    variants: [std('128GB', 45990, 49990), std('256GB', 51990, 53990)],
  },
  {
    name: 'iPhone 16 Pro Max',
    slug: 'iphone-16-pro-max',
    model: 'iPhone 16 Pro Max',
    categorySlug: 'iphone',
    description: describe('The largest display Apple has put on an iPhone Pro, with the full Pro camera system.', [
      'STANDARD',
    ]),
    highlights: [
      '6.9" Super Retina XDR with ProMotion',
      'Titanium design',
      'A18 Pro chip',
      '48MP Fusion + 5x telephoto',
      'Camera Control',
    ],
    releaseYear: 2024,
    skuBase: 'IP16PM',
    flags: { isFeatured: true },
    variants: [std('256GB', 54990, 58990), std('512GB', 58990, 62990)],
  },
  {
    name: 'iPhone 17',
    slug: 'iphone-17',
    model: 'iPhone 17',
    categorySlug: 'iphone',
    description: describe('The current standard iPhone — and the first non-Pro with a 120Hz ProMotion screen.', [
      'STANDARD',
      'NEW',
    ]),
    highlights: ['6.3" display with ProMotion', 'A19 chip', '48MP main camera', 'USB-C charging'],
    releaseYear: 2025,
    skuBase: 'IP17',
    flags: { isNewArrival: true },
    variants: [std('256GB', 49990, 52990), sealed('256GB', 56990, 60990)],
  },
  {
    name: 'iPhone 17 Air',
    slug: 'iphone-17-air',
    model: 'iPhone 17 Air',
    categorySlug: 'iphone',
    description: describe('The thinnest iPhone in the line-up, in titanium, with a big screen and almost no weight.', [
      'STANDARD',
    ]),
    highlights: ['Ultra-thin titanium design', '6.5" display with ProMotion', 'A19 Pro chip', '48MP camera'],
    releaseYear: 2025,
    skuBase: 'IP17AIR',
    flags: { isNewArrival: true },
    variants: [std('256GB', 46990, 49990)],
  },
  {
    name: 'iPhone 17 Pro Max',
    slug: 'iphone-17-pro-max',
    model: 'iPhone 17 Pro Max',
    categorySlug: 'iphone',
    description: describe('The top of the line-up: the biggest Pro screen, the fastest chip and the full Pro camera.', [
      'NEW',
    ]),
    highlights: ['6.9" display with ProMotion', 'A19 Pro chip', 'Pro 48MP camera system', 'USB-C charging'],
    releaseYear: 2025,
    skuBase: 'IP17PM',
    flags: { isNewArrival: true, isFeatured: true },
    variants: [sealed('256GB', 86990, 93990)],
  },
];

// ── iPad ────────────────────────────────────────────────────────────────────

const IPADS: CatalogProductDef[] = [
  {
    name: 'iPad (11th gen)',
    slug: 'ipad-11th-gen',
    model: 'iPad (A16)',
    categorySlug: 'ipad',
    description: describe('The everyday iPad: big screen, all-day battery, and enough speed for school or work.', [
      'NEW',
    ]),
    highlights: ['11" Liquid Retina display', 'A16 chip', 'Touch ID', 'USB-C charging'],
    releaseYear: 2025,
    skuBase: 'IPAD11',
    flags: { isNewArrival: true, isFeatured: true },
    variants: [sealed('128GB', 29990, 33990)],
  },
  {
    name: 'iPad mini (6th gen)',
    slug: 'ipad-mini-6',
    model: 'iPad mini (6th generation)',
    categorySlug: 'ipad',
    description: describe(
      'Pocketable iPad that takes a SIM, so it works away from Wi-Fi — good for deliveries, notes and reading.',
      ['NEW'],
    ),
    highlights: ['8.3" Liquid Retina display', 'A15 Bionic chip', 'Wi-Fi + Cellular', 'Touch ID in the top button'],
    releaseYear: 2021,
    skuBase: 'IPADM6',
    // Connectivity belongs in the size label so the sheet's row maps 1:1, but the
    // SKU keeps the bare number: IPADM6-64-NEW.
    variants: [{ storage: '64GB Wi-Fi + Cellular', skuStorage: '64', condition: 'NEW', cash: 24990, installment: 28990 }],
  },
];

/**
 * Everything above, in the order the storefront's "newest" sort will mostly keep
 * anyway. Installments are on for every listing (the sheet quotes a monthly base
 * for all of them); the down-payment floor is DEFAULT_MIN_DOWN_PCT unless a def
 * overrides it.
 */
export const REAL_CATALOG: CatalogProductDef[] = [...PRE_OWNED, ...STANDARD_AND_NEW, ...IPADS];
