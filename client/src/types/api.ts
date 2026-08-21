// Shared API types — mirror the server's response mappers exactly. Money is
// exposed as display numbers (the server re-derives authoritative money at
// checkout, so these are safe for rendering).

export interface ProductColor {
  name: string;
  hex: string | null;
}

/** Condition of a catalog variant — JLP sells brand-new AND pre-owned units. */
export type ProductCondition = 'NEW' | 'OPEN_BOX' | 'PREOWNED' | 'REFURBISHED';

/** Card shape from GET /api/products (list). */
export interface ProductCard {
  id: string;
  slug: string;
  name: string;
  brand: string;
  model: string | null;
  categorySlug: string;
  categoryName: string;
  releaseYear: number | null;
  discountPct: number;
  isFeatured: boolean;
  isNewArrival: boolean;
  isBestSeller: boolean;
  isDeal: boolean;
  /** Listing-level "Pre-loved" flag — separate from per-variant `conditions`. */
  isPreOwned: boolean;
  /** Product-level installment opt-in (terms live in config/installment). */
  installmentAvailable: boolean;
  priceFrom: number;
  priceTo: number;
  image: string | null;
  imageAlt: string;
  storages: string[];
  colors: ProductColor[];
  /** Distinct conditions across the active variants — usually just ["NEW"]. */
  conditions: ProductCondition[];
  totalStock: number;
  inStock: boolean;
}

export interface ProductImage {
  id: string;
  url: string;
  alt: string;
  position: number;
}

export interface ProductVariant {
  id: string;
  sku: string;
  storage: string;
  color: string;
  colorHex: string | null;
  price: number;
  image: string | null;
  stock: number;
  inStock: boolean;
  lowStock: boolean;
  condition: ProductCondition;
  /** Battery percentage — set on pre-owned/refurbished units only. */
  batteryHealth: number | null;
  conditionNote: string | null;
}

/** Detail shape from GET /api/products/:idOrSlug. */
export interface ProductDetail {
  id: string;
  slug: string;
  name: string;
  brand: string;
  model: string | null;
  description: string;
  highlights: string[];
  categorySlug: string;
  categoryName: string;
  releaseYear: number | null;
  discountPct: number;
  isFeatured: boolean;
  isNewArrival: boolean;
  isBestSeller: boolean;
  isDeal: boolean;
  isPreOwned: boolean;
  installmentAvailable: boolean;
  /** Minimum down payment as a % of the variant price (0–90). */
  installmentMinDownPct: number;
  priceFrom: number;
  priceTo: number;
  totalStock: number;
  inStock: boolean;
  images: ProductImage[];
  variants: ProductVariant[];
}

/**
 * A JLP branch from GET /api/branches (active only, in display order). Only the
 * locations we actually have a street address for expose `addressLine`; the rest
 * carry city/province only. Stock is GLOBAL — a branch is a preferred pickup /
 * contact point, never a separate inventory.
 */
export interface Branch {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  province: string | null;
  addressLine: string | null;
  phone: string | null;
  email: string | null;
  hours: string | null;
  lat: number | null;
  lng: number | null;
  /** Pre-selected in branch pickers. */
  isDefault: boolean;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  position: number;
  productCount: number;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export type ProductSort = 'newest' | 'price_asc' | 'price_desc' | 'bestselling' | 'name';

export interface ProductListParams {
  q?: string;
  category?: string;
  featured?: boolean;
  bestSeller?: boolean;
  newArrival?: boolean;
  deal?: boolean;
  /** Restrict to listings flagged pre-loved. */
  preOwned?: boolean;
  /** Restrict to products that accept installment plans. */
  installment?: boolean;
  inStock?: boolean;
  minPrice?: number;
  maxPrice?: number;
  sort?: ProductSort;
  page?: number;
  pageSize?: number;
}
