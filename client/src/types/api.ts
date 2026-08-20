// Shared API types — mirror the server's response mappers exactly. Money is
// exposed as display numbers (the server re-derives authoritative money at
// checkout, so these are safe for rendering).

export interface ProductColor {
  name: string;
  hex: string | null;
}

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
  priceFrom: number;
  priceTo: number;
  image: string | null;
  imageAlt: string;
  storages: string[];
  colors: ProductColor[];
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
  priceFrom: number;
  priceTo: number;
  totalStock: number;
  inStock: boolean;
  images: ProductImage[];
  variants: ProductVariant[];
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
  inStock?: boolean;
  minPrice?: number;
  maxPrice?: number;
  sort?: ProductSort;
  page?: number;
  pageSize?: number;
}
