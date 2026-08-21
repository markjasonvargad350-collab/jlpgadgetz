import { Prisma, ProductStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';

export type ProductSort = 'newest' | 'price_asc' | 'price_desc' | 'bestselling' | 'name';

export interface ProductQuery {
  q?: string;
  category?: string;
  featured?: boolean;
  bestSeller?: boolean;
  newArrival?: boolean;
  deal?: boolean;
  /** Only listings flagged pre-loved / second-hand at the product level. */
  preOwned?: boolean;
  /** Only products the owner has opted into installment plans. */
  installment?: boolean;
  inStock?: boolean;
  minPrice?: number;
  maxPrice?: number;
  sort: ProductSort;
  page: number;
  pageSize: number;
}

// ── Prisma query shapes (typed via GetPayload so mapping is fully checked) ──
//
// These use `select` (not `include`) to fetch only the columns the mappers
// below actually read — no over-fetching whole Category/Variant rows. The card
// shape is deliberately leaner than the detail shape; `VariantRow` is derived
// from the card shape, so it stays a structural subset of the detail variant
// (the shared price/colour/storage helpers accept either).

const cardSelect = {
  id: true,
  slug: true,
  name: true,
  brand: true,
  model: true,
  basePrice: true,
  releaseYear: true,
  discountPct: true,
  isFeatured: true,
  isNewArrival: true,
  isBestSeller: true,
  isDeal: true,
  isPreOwned: true,
  installmentAvailable: true,
  category: { select: { slug: true, name: true } },
  images: { select: { url: true, alt: true }, orderBy: { position: 'asc' }, take: 1 },
  variants: {
    where: { isActive: true },
    orderBy: { price: 'asc' },
    select: { storage: true, color: true, colorHex: true, price: true, stock: true, condition: true },
  },
} satisfies Prisma.ProductSelect;

const detailSelect = {
  id: true,
  slug: true,
  name: true,
  brand: true,
  model: true,
  description: true,
  highlights: true,
  basePrice: true,
  releaseYear: true,
  discountPct: true,
  isFeatured: true,
  isNewArrival: true,
  isBestSeller: true,
  isDeal: true,
  isPreOwned: true,
  installmentAvailable: true,
  installmentMinDownPct: true,
  category: { select: { slug: true, name: true } },
  images: { select: { id: true, url: true, alt: true, position: true }, orderBy: { position: 'asc' } },
  variants: {
    where: { isActive: true },
    orderBy: [{ price: 'asc' }, { storage: 'asc' }],
    select: {
      id: true,
      sku: true,
      storage: true,
      color: true,
      colorHex: true,
      price: true,
      imageUrl: true,
      stock: true,
      lowStockThreshold: true,
      condition: true,
      batteryHealth: true,
      conditionNote: true,
    },
  },
} satisfies Prisma.ProductSelect;

type ProductCardRow = Prisma.ProductGetPayload<{ select: typeof cardSelect }>;
type ProductDetailRow = Prisma.ProductGetPayload<{ select: typeof detailSelect }>;

type VariantRow = ProductCardRow['variants'][number];

// ── Where / order builders ──

function buildWhere(query: ProductQuery): Prisma.ProductWhereInput {
  // Public catalog only ever exposes ACTIVE products.
  const where: Prisma.ProductWhereInput = { status: ProductStatus.ACTIVE };

  if (query.category) where.category = { slug: query.category };
  if (query.featured) where.isFeatured = true;
  if (query.bestSeller) where.isBestSeller = true;
  if (query.newArrival) where.isNewArrival = true;
  if (query.deal) where.isDeal = true;
  if (query.preOwned) where.isPreOwned = true;
  if (query.installment) where.installmentAvailable = true;

  if (query.q) {
    where.OR = [
      { name: { contains: query.q, mode: 'insensitive' } },
      { model: { contains: query.q, mode: 'insensitive' } },
      { brand: { contains: query.q, mode: 'insensitive' } },
    ];
  }

  const hasPrice = query.minPrice != null || query.maxPrice != null;
  if (hasPrice || query.inStock) {
    const price: Prisma.DecimalFilter = {};
    if (query.minPrice != null) price.gte = query.minPrice;
    if (query.maxPrice != null) price.lte = query.maxPrice;
    where.variants = {
      some: {
        isActive: true,
        ...(hasPrice ? { price } : {}),
        ...(query.inStock ? { stock: { gt: 0 } } : {}),
      },
    };
  }

  return where;
}

function buildOrderBy(
  sort: ProductSort,
): Prisma.ProductOrderByWithRelationInput | Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case 'price_asc':
      return { basePrice: 'asc' };
    case 'price_desc':
      return { basePrice: 'desc' };
    case 'name':
      return { name: 'asc' };
    // Real per-unit sales analytics live in the reports phase; for storefront
    // ordering we surface flagged best-sellers, newest first.
    case 'bestselling':
      return [{ isBestSeller: 'desc' }, { releaseYear: 'desc' }, { createdAt: 'desc' }];
    case 'newest':
    default:
      return [{ releaseYear: 'desc' }, { createdAt: 'desc' }];
  }
}

// ── Mappers (Decimal → number for display; money is re-derived server-side at
//    checkout, so display numbers are safe) ──

function uniqueStorages(variants: VariantRow[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of variants) {
    if (!seen.has(v.storage)) {
      seen.add(v.storage);
      out.push(v.storage);
    }
  }
  return out;
}

function uniqueColors(variants: VariantRow[]): { name: string; hex: string | null }[] {
  const seen = new Set<string>();
  const out: { name: string; hex: string | null }[] = [];
  for (const v of variants) {
    if (!seen.has(v.color)) {
      seen.add(v.color);
      out.push({ name: v.color, hex: v.colorHex });
    }
  }
  return out;
}

function priceRange(variants: VariantRow[], fallback: Prisma.Decimal): { from: number; to: number } {
  if (variants.length === 0) {
    const n = fallback.toNumber();
    return { from: n, to: n };
  }
  const prices = variants.map((v) => v.price.toNumber());
  return { from: Math.min(...prices), to: Math.max(...prices) };
}

// Distinct conditions across a product's active variants (usually just ["NEW"],
// but a product may carry a pre-owned variant alongside a new one). Lets the
// storefront show a "Pre-owned" badge when any non-NEW variant exists.
function uniqueConditions(variants: { condition: string }[]): string[] {
  const seen = new Set<string>();
  for (const v of variants) seen.add(v.condition);
  return [...seen];
}

function toCard(p: ProductCardRow) {
  const { from, to } = priceRange(p.variants, p.basePrice);
  const totalStock = p.variants.reduce((s, v) => s + v.stock, 0);
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    model: p.model,
    categorySlug: p.category.slug,
    categoryName: p.category.name,
    releaseYear: p.releaseYear,
    discountPct: p.discountPct,
    isFeatured: p.isFeatured,
    isNewArrival: p.isNewArrival,
    isBestSeller: p.isBestSeller,
    isDeal: p.isDeal,
    isPreOwned: p.isPreOwned,
    installmentAvailable: p.installmentAvailable,
    priceFrom: from,
    priceTo: to,
    image: p.images[0]?.url ?? null,
    imageAlt: p.images[0]?.alt ?? p.name,
    storages: uniqueStorages(p.variants),
    colors: uniqueColors(p.variants),
    conditions: uniqueConditions(p.variants),
    totalStock,
    inStock: totalStock > 0,
  };
}

function toDetail(p: ProductDetailRow) {
  const { from, to } = priceRange(p.variants, p.basePrice);
  const totalStock = p.variants.reduce((s, v) => s + v.stock, 0);
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    model: p.model,
    description: p.description,
    highlights: p.highlights,
    categorySlug: p.category.slug,
    categoryName: p.category.name,
    releaseYear: p.releaseYear,
    discountPct: p.discountPct,
    isFeatured: p.isFeatured,
    isNewArrival: p.isNewArrival,
    isBestSeller: p.isBestSeller,
    isDeal: p.isDeal,
    isPreOwned: p.isPreOwned,
    installmentAvailable: p.installmentAvailable,
    installmentMinDownPct: p.installmentMinDownPct,
    priceFrom: from,
    priceTo: to,
    totalStock,
    inStock: totalStock > 0,
    images: p.images.map((i) => ({ id: i.id, url: i.url, alt: i.alt ?? p.name, position: i.position })),
    variants: p.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      storage: v.storage,
      color: v.color,
      colorHex: v.colorHex,
      price: v.price.toNumber(),
      image: v.imageUrl,
      stock: v.stock,
      inStock: v.stock > 0,
      lowStock: v.stock > 0 && v.stock <= v.lowStockThreshold,
      condition: v.condition,
      batteryHealth: v.batteryHealth,
      conditionNote: v.conditionNote,
    })),
  };
}

// ── Public API ──

export async function listProducts(query: ProductQuery) {
  const where = buildWhere(query);
  const skip = (query.page - 1) * query.pageSize;

  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      select: cardSelect,
      orderBy: buildOrderBy(query.sort),
      skip,
      take: query.pageSize,
    }),
  ]);

  return {
    items: rows.map(toCard),
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export async function getProduct(idOrSlug: string) {
  const product = await prisma.product.findFirst({
    where: { status: ProductStatus.ACTIVE, OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    select: detailSelect,
  });
  if (!product) {
    throw ApiError.notFound('Product not found');
  }
  return toDetail(product);
}
