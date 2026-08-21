// Admin (back-office) API types. Mirror the server's response mappers exactly.
// Money is exposed as display numbers; Dates arrive as ISO strings over JSON.

import type { OrderStatus, PaymentStatus, PaymentMethod } from './order';
import type { ProductCondition } from './api';
import type { TradeInStatus } from './tradeIn';
import type { InstallmentStatus } from './installment';

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
  /** Unit condition — a NEW and a PREOWNED "256GB / Black" can coexist. */
  condition: ProductCondition;
  /** Percent, pre-owned units only. Null on brand-new stock. */
  batteryHealth: number | null;
  /** Free-text note on scratches, warranty, what's in the box, etc. */
  conditionNote: string | null;
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
  isPreOwned: boolean;
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
  /** Listing-level "Pre-owned" flag; per-unit state is each variant's condition. */
  isPreOwned: boolean;
  releaseYear: number | null;
  categoryId: string;
  categorySlug: string;
  categoryName: string;
  /** Per-product opt-in: does this product accept an installment application? */
  installmentAvailable: boolean;
  /** Smallest accepted down payment as a percent of price (0–90). */
  installmentMinDownPct: number;
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

// ── Branches (admin.branch.service → toAdminBranch) ───────────────────────────

/**
 * A branch as the back-office sees it. Branches are informational: customers
 * pick one for convenience, but the catalog and stock stay global, so nothing
 * here affects prices or availability.
 */
export interface AdminBranch {
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
  /** Manual sort order on the storefront (ascending, then by name). */
  position: number;
  isActive: boolean;
  /** The "main" branch — at most one row carries this. */
  isDefault: boolean;
  orderCount: number;
  tradeInCount: number;
  installmentCount: number;
  /** False once anything references the branch → deactivate instead of delete. */
  canDelete: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Trade-ins (admin.tradein.service → toTradeInCard) ─────────────────────────

/**
 * List row for GET /api/admin/trade-ins. Valuations are null until a staff
 * member enters them — nothing in this feature computes an offer.
 */
export interface AdminTradeInCard {
  id: string;
  reference: string;
  customerName: string;
  /** "Brand Model", pre-joined server-side. */
  device: string;
  status: TradeInStatus;
  quotedValue: number | null;
  finalValue: number | null;
  branch: { id: string; name: string } | null;
  submittedAt: string;
}

// ── Installments (admin.installment.service → toInstallmentCard) ──────────────

/** List row for GET /api/admin/installments. Money is server-computed. */
export interface AdminInstallmentCard {
  id: string;
  reference: string;
  customerName: string;
  /** "Product · Variant", pre-joined server-side. */
  product: string;
  status: InstallmentStatus;
  termMonths: number;
  /** price − downPayment: the financed amount. */
  principal: number;
  monthlyAmount: number;
  branch: { id: string; name: string } | null;
  appliedAt: string;
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

export interface AdminBranchParams {
  q?: string;
  /** Omit for all branches; true/false filters on isActive. */
  active?: boolean;
  page?: number;
  pageSize?: number; // server default 50
}

export interface AdminTradeInParams {
  q?: string;
  status?: TradeInStatus;
  page?: number;
  pageSize?: number; // server default 20
}

export interface AdminInstallmentParams {
  q?: string;
  status?: InstallmentStatus;
  page?: number;
  pageSize?: number; // server default 20
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
  condition?: ProductCondition;
  batteryHealth?: number;
  conditionNote?: string;
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
  condition?: ProductCondition;
  batteryHealth?: number | null;
  conditionNote?: string | null;
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
  isPreOwned?: boolean;
  releaseYear?: number;
  categoryId: string;
  installmentAvailable?: boolean;
  installmentMinDownPct?: number;
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
  isPreOwned?: boolean;
  releaseYear?: number | null;
  categoryId?: string;
  installmentAvailable?: boolean;
  installmentMinDownPct?: number;
}

// ── Branch / trade-in / installment mutation inputs ───────────────────────────

export interface BranchCreateInput {
  name: string;
  slug?: string;
  city?: string;
  province?: string;
  addressLine?: string;
  phone?: string;
  email?: string;
  hours?: string;
  lat?: number;
  lng?: number;
  position?: number;
  isActive?: boolean;
  isDefault?: boolean;
}

/** Every field optional; nullable ones clear the stored value when sent as null. */
export interface BranchUpdateInput {
  name?: string;
  slug?: string;
  city?: string | null;
  province?: string | null;
  addressLine?: string | null;
  phone?: string | null;
  email?: string | null;
  hours?: string | null;
  lat?: number | null;
  lng?: number | null;
  position?: number;
  isActive?: boolean;
  isDefault?: boolean;
}

/**
 * PATCH /api/admin/trade-ins/:id. Staff may advance the workflow and/or record
 * the valuation they arrived at on inspection — the server validates the numbers
 * are non-negative but never derives them.
 */
export interface TradeInUpdateInput {
  status?: TradeInStatus;
  quotedValue?: number | null;
  finalValue?: number | null;
  staffNotes?: string | null;
}

/** PATCH /api/admin/installments/:id — `status` is required by the server. */
export interface InstallmentStatusUpdateInput {
  status: InstallmentStatus;
  staffNotes?: string | null;
}

/**
 * POST /api/admin/installments/:id/payments/:paymentId. Additive only: the row
 * is updated, never replaced, and the server rejects anything over the remaining
 * balance.
 */
export interface RecordPaymentInput {
  amount: number;
  method?: PaymentMethod;
  reference?: string;
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
