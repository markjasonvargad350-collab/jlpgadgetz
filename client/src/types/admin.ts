// Admin (back-office) API types. Mirror the server's response mappers exactly.
// Money is exposed as display numbers; Dates arrive as ISO strings over JSON.

import type { OrderStatus, PaymentStatus, PaymentMethod } from './order';

/** Role names seeded on the server. Widened with `string` so an unknown role
 *  never breaks typing, while the two known literals stay autocompletable. */
export type AdminRole = 'ADMIN' | 'STAFF' | (string & {});

/** Shape of `admin` from POST /login and GET /me (server AdminProfile). */
export interface AdminProfile {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  lastLoginAt: string | null;
}

/** GET /api/admin/inventory/stats — dashboard counts (in/low/out, units, value). */
export interface InventoryStats {
  totalVariants: number;
  activeVariants: number;
  inStock: number; // stock > lowStockThreshold
  low: number; // 0 < stock <= lowStockThreshold
  out: number; // stock <= 0
  totalUnits: number;
  totalStockValue: number;
}

// ── Enums (string unions mirroring Prisma) ────────────────────────────────────

export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type StockStatus = 'IN_STOCK' | 'LOW' | 'OUT';
export type InventoryTxnType = 'RESTOCK' | 'SALE' | 'RETURN' | 'ADJUSTMENT' | 'CANCELLATION';

// ── Products & variants (admin.product.service mappers) ───────────────────────

/** A product image (toAdminDetail.images / POST images response). */
export interface AdminImage {
  id: string;
  url: string;
  alt: string | null;
  position: number;
}

/** A variant as embedded in the product detail (mapVariant). */
export interface AdminVariant {
  id: string;
  sku: string;
  storage: string;
  color: string;
  colorHex: string | null;
  price: number;
  stock: number;
  reservedStock: number;
  soldQty: number;
  lowStockThreshold: number;
  imageUrl: string | null;
  isActive: boolean;
  lowStock: boolean;
  /** True when the variant has ledger/sales history → can't be hard-deleted. */
  hasHistory: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A variant returned by the variant/adjust endpoints (mapVariantDetail): adds
 *  the parent product summary. */
export interface AdminVariantDetail extends AdminVariant {
  product: { id: string; name: string; slug: string };
}

/** Card shape from GET /api/admin/products (toAdminCard). */
export interface AdminProductCard {
  id: string;
  slug: string;
  name: string;
  brand: string;
  model: string | null;
  status: ProductStatus;
  categoryName: string;
  basePrice: number;
  discountPct: number;
  isFeatured: boolean;
  isNewArrival: boolean;
  isBestSeller: boolean;
  isDeal: boolean;
  releaseYear: number | null;
  image: string | null;
  variantCount: number;
  activeVariantCount: number;
  totalStock: number;
  updatedAt: string;
}

/** Detail shape from GET /api/admin/products/:id (toAdminDetail). */
export interface AdminProductDetail {
  id: string;
  slug: string;
  name: string;
  brand: string;
  model: string | null;
  description: string;
  highlights: string[];
  basePrice: number;
  discountPct: number;
  status: ProductStatus;
  isFeatured: boolean;
  isNewArrival: boolean;
  isBestSeller: boolean;
  isDeal: boolean;
  releaseYear: number | null;
  categoryId: string;
  categorySlug: string;
  categoryName: string;
  images: AdminImage[];
  variants: AdminVariant[];
  totalStock: number;
  createdAt: string;
  updatedAt: string;
}

// ── Inventory (admin.inventory.service mappers) ───────────────────────────────

/** A variant-centric stock row from GET /api/admin/inventory (toInventoryRow). */
export interface InventoryRow {
  variantId: string;
  sku: string;
  productName: string;
  productSlug: string;
  productStatus: ProductStatus;
  categoryName: string;
  categorySlug: string;
  storage: string;
  color: string;
  colorHex: string | null;
  price: number;
  stock: number;
  reservedStock: number;
  soldQty: number;
  lowStockThreshold: number;
  isActive: boolean;
  status: StockStatus;
  updatedAt: string;
}

/** A ledger row from GET /api/admin/inventory/transactions (toTxn). */
export interface InventoryTxn {
  id: string;
  type: InventoryTxnType;
  previousStock: number;
  quantityChanged: number;
  newStock: number;
  reason: string | null;
  variantId: string;
  sku: string;
  variantLabel: string;
  productName: string;
  adminName: string | null;
  orderNumber: string | null;
  createdAt: string;
}

// ── Orders (admin.order.service mappers) ──────────────────────────────────────

/** Card shape from GET /api/admin/orders (toOrderCard). */
export interface AdminOrderCard {
  orderNumber: string;
  customerName: string;
  itemCount: number;
  total: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  placedAt: string;
}

// ── Reports (report.service mappers) ──────────────────────────────────────────

/** Orders + revenue for one time window (revenue excludes cancelled orders). */
export interface ReportKpi {
  orders: number;
  revenue: number;
}

/** One point in the 30-day revenue series (date is a Manila-day YYYY-MM-DD). */
export interface ReportDayPoint {
  date: string;
  revenue: number;
  orders: number;
}

export interface ReportStatusSlice {
  status: OrderStatus;
  count: number;
}

export interface ReportPaymentSlice {
  method: PaymentMethod;
  count: number;
  total: number;
}

export interface ReportTopProduct {
  productName: string;
  quantity: number;
  revenue: number;
}

/** GET /api/admin/reports/summary — dashboard + Reports page analytics. */
export interface ReportSummary {
  kpis: {
    today: ReportKpi;
    last7Days: ReportKpi;
    last30Days: ReportKpi;
    allTime: ReportKpi;
  };
  /** All-time revenue whose payment is actually settled (paymentStatus = PAID). */
  paidRevenueAllTime: number;
  averageOrderValue: number;
  /** Every OrderStatus, zero-filled. */
  statusBreakdown: ReportStatusSlice[];
  /** Every PaymentMethod, non-cancelled, zero-filled. */
  paymentMix: ReportPaymentSlice[];
  /** Exactly 30 Manila days, oldest → newest, zero-filled. */
  revenueByDay: ReportDayPoint[];
  /** Up to 5 best-selling products by units sold. */
  topProducts: ReportTopProduct[];
}

// ── Query params (mirror the server validators) ───────────────────────────────

export type AdminProductSort = 'newest' | 'name' | 'price_asc' | 'price_desc';

export interface AdminProductParams {
  q?: string;
  status?: ProductStatus;
  category?: string; // slug
  sort?: AdminProductSort;
  page?: number;
  pageSize?: number;
}

export type InventoryStatusFilter = 'all' | 'in' | 'low' | 'out';
export type InventorySort = 'stock_asc' | 'stock_desc' | 'sku' | 'updated';

export interface InventoryParams {
  q?: string;
  status?: InventoryStatusFilter;
  category?: string; // slug
  sort?: InventorySort;
  page?: number;
  pageSize?: number;
}

export interface TransactionParams {
  variantId?: string;
  type?: InventoryTxnType;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export type OrderSort = 'placed_desc' | 'placed_asc' | 'total_desc' | 'total_asc';

export interface AdminOrderParams {
  q?: string;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  from?: string; // ISO date (Manila-day boundary applied server-side)
  to?: string;
  sort?: OrderSort;
  page?: number;
  pageSize?: number;
}

// ── Mutation inputs (mirror the server validators) ────────────────────────────

export interface ImageInput {
  url: string;
  alt?: string;
  position?: number;
}

export interface VariantCreateInput {
  sku: string;
  storage: string;
  color: string;
  colorHex?: string;
  price: number;
  initialStock?: number;
  lowStockThreshold?: number;
  imageUrl?: string;
  isActive?: boolean;
}

/** All non-stock fields optional; stock only moves via the inventory ledger. */
export interface VariantUpdateInput {
  sku?: string;
  storage?: string;
  color?: string;
  colorHex?: string | null;
  price?: number;
  lowStockThreshold?: number;
  imageUrl?: string | null;
  isActive?: boolean;
}

export interface ProductCreateInput {
  name: string;
  slug?: string;
  brand?: string;
  model?: string;
  description: string;
  highlights?: string[];
  basePrice: number;
  discountPct?: number;
  status?: ProductStatus;
  isFeatured?: boolean;
  isNewArrival?: boolean;
  isBestSeller?: boolean;
  isDeal?: boolean;
  releaseYear?: number;
  categoryId: string;
  images?: ImageInput[];
  variants?: VariantCreateInput[];
}

export interface ProductUpdateInput {
  name?: string;
  slug?: string;
  brand?: string;
  model?: string | null;
  description?: string;
  highlights?: string[];
  basePrice?: number;
  discountPct?: number;
  status?: ProductStatus;
  isFeatured?: boolean;
  isNewArrival?: boolean;
  isBestSeller?: boolean;
  isDeal?: boolean;
  releaseYear?: number | null;
  categoryId?: string;
}

/** POST /api/admin/inventory/adjust body — a discriminated union on `mode`. */
export type AdjustInput =
  | {
      mode: 'delta';
      variantId: string;
      type: 'RESTOCK' | 'RETURN' | 'CANCELLATION' | 'ADJUSTMENT';
      quantity: number;
      reason?: string;
    }
  | { mode: 'set'; variantId: string; newStock: number; reason?: string };

/** Response of a successful adjust (variant + the ledger row it produced). */
export interface AdjustResult {
  variant: AdminVariantDetail;
  transaction: InventoryTxn;
}

/** Shape returned by hard-delete endpoints. */
export interface DeleteResult {
  id: string;
  deleted: true;
}
