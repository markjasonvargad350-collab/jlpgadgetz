import { Prisma, InventoryTxnType } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { recordInventoryChange } from './inventory.service';
import { getVariant } from './admin.product.service';
import { logAudit } from './audit.service';
import type {
  InventoryListQuery,
  TransactionsQuery,
  AdjustInput,
} from '../validators/admin.inventory.validator';

// ── Stock status ─────────────────────────────────────────────────────────────

type StockStatus = 'IN_STOCK' | 'LOW' | 'OUT';

/** Same LOW boundary as the `lowStock` flag in admin.product.service.ts. */
function stockStatus(stock: number, lowStockThreshold: number): StockStatus {
  if (stock <= 0) return 'OUT';
  if (stock <= lowStockThreshold) return 'LOW';
  return 'IN_STOCK';
}

// ── Inventory list (variant-centric) ─────────────────────────────────────────

const inventoryVariantInclude = {
  product: {
    select: {
      name: true,
      slug: true,
      status: true,
      category: { select: { name: true, slug: true } },
    },
  },
} satisfies Prisma.ProductVariantInclude;

type InventoryVariantRow = Prisma.ProductVariantGetPayload<{ include: typeof inventoryVariantInclude }>;

function toInventoryRow(v: InventoryVariantRow) {
  return {
    variantId: v.id,
    sku: v.sku,
    productName: v.product.name,
    productSlug: v.product.slug,
    productStatus: v.product.status,
    categoryName: v.product.category.name,
    categorySlug: v.product.category.slug,
    storage: v.storage,
    color: v.color,
    colorHex: v.colorHex,
    price: v.price.toNumber(),
    stock: v.stock,
    reservedStock: v.reservedStock,
    soldQty: v.soldQty,
    lowStockThreshold: v.lowStockThreshold,
    isActive: v.isActive,
    status: stockStatus(v.stock, v.lowStockThreshold),
    updatedAt: v.updatedAt,
  };
}

/**
 * Status → DB predicate using Prisma field references so the filter and the
 * count() agree (post-filtering in JS would desync `total`/`totalPages`).
 */
function statusWhere(status: InventoryListQuery['status']): Prisma.ProductVariantWhereInput {
  const f = prisma.productVariant.fields;
  switch (status) {
    case 'out':
      return { stock: { lte: 0 } };
    case 'low':
      return { stock: { gt: 0, lte: f.lowStockThreshold } };
    case 'in':
      return { stock: { gt: f.lowStockThreshold } };
    default:
      return {};
  }
}

export async function listInventory(query: InventoryListQuery) {
  const where: Prisma.ProductVariantWhereInput = { ...statusWhere(query.status) };
  if (query.q) {
    where.OR = [
      { sku: { contains: query.q, mode: 'insensitive' } },
      { product: { name: { contains: query.q, mode: 'insensitive' } } },
    ];
  }
  if (query.category) {
    where.product = { category: { slug: query.category } };
  }

  // Every sort carries an `id` tiebreaker so pages don't reshuffle on ties
  // (stock_asc in particular has many equal values).
  const orderBy: Prisma.ProductVariantOrderByWithRelationInput[] =
    query.sort === 'stock_desc'
      ? [{ stock: 'desc' }, { id: 'asc' }]
      : query.sort === 'sku'
        ? [{ sku: 'asc' }, { id: 'asc' }]
        : query.sort === 'updated'
          ? [{ updatedAt: 'desc' }, { id: 'asc' }]
          : [{ stock: 'asc' }, { id: 'asc' }]; // stock_asc (default) surfaces problems first

  const skip = (query.page - 1) * query.pageSize;
  const [total, rows] = await Promise.all([
    prisma.productVariant.count({ where }),
    prisma.productVariant.findMany({ where, include: inventoryVariantInclude, orderBy, skip, take: query.pageSize }),
  ]);

  return {
    items: rows.map(toInventoryRow),
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

// ── Inventory stats (dashboard summary) ──────────────────────────────────────

export async function inventoryStats() {
  const f = prisma.productVariant.fields;
  const [totalVariants, activeVariants, out, low, inStock, sumAgg, valueRows] = await Promise.all([
    prisma.productVariant.count(),
    prisma.productVariant.count({ where: { isActive: true } }),
    prisma.productVariant.count({ where: { stock: { lte: 0 } } }),
    prisma.productVariant.count({ where: { stock: { gt: 0, lte: f.lowStockThreshold } } }),
    prisma.productVariant.count({ where: { stock: { gt: f.lowStockThreshold } } }),
    prisma.productVariant.aggregate({ _sum: { stock: true } }),
    // _sum can't multiply two columns; SUM(stock*price) needs raw SQL. COALESCE
    // handles the empty table (SUM over no rows is NULL). The numeric may come
    // back as a string from the driver, so coerce explicitly.
    prisma.$queryRaw<{ value: string | number | null }[]>(
      Prisma.sql`SELECT COALESCE(SUM("stock" * "price"), 0) AS value FROM "ProductVariant"`,
    ),
  ]);

  return {
    totalVariants,
    activeVariants,
    inStock, // stock > lowStockThreshold
    low, // 0 < stock <= lowStockThreshold
    out, // stock <= 0  (out + low + inStock === totalVariants)
    totalUnits: sumAgg._sum.stock ?? 0,
    totalStockValue: Number(valueRows[0]?.value ?? 0),
  };
}

// ── Inventory ledger (transactions) ──────────────────────────────────────────

const txnInclude = {
  variant: { select: { sku: true, storage: true, color: true, product: { select: { name: true } } } },
  admin: { select: { name: true } },
  order: { select: { orderNumber: true } },
} satisfies Prisma.InventoryTransactionInclude;

type TxnRow = Prisma.InventoryTransactionGetPayload<{ include: typeof txnInclude }>;

function toTxn(t: TxnRow) {
  return {
    id: t.id,
    type: t.type,
    previousStock: t.previousStock,
    quantityChanged: t.quantityChanged,
    newStock: t.newStock,
    reason: t.reason,
    variantId: t.variantId,
    sku: t.variant.sku,
    variantLabel: `${t.variant.storage} · ${t.variant.color}`,
    productName: t.variant.product.name,
    adminName: t.admin?.name ?? null, // null for system rows (e.g. SALE from an order)
    orderNumber: t.order?.orderNumber ?? null,
    createdAt: t.createdAt,
  };
}

export async function listTransactions(query: TransactionsQuery) {
  const where: Prisma.InventoryTransactionWhereInput = {};
  if (query.variantId) where.variantId = query.variantId;
  if (query.type) where.type = query.type;
  if (query.from || query.to) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (query.from) createdAt.gte = query.from;
    if (query.to) {
      // Normalize a bare `to` date to end-of-day so e.g. to=2026-08-20 is inclusive.
      const to = new Date(query.to);
      to.setHours(23, 59, 59, 999);
      createdAt.lte = to;
    }
    where.createdAt = createdAt;
  }

  const skip = (query.page - 1) * query.pageSize;
  const [total, rows] = await Promise.all([
    prisma.inventoryTransaction.count({ where }),
    prisma.inventoryTransaction.findMany({
      where,
      include: txnInclude,
      // Secondary `id` key: a multi-line order writes several rows at the same
      // instant — without it they'd reorder across pages.
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip,
      take: query.pageSize,
    }),
  ]);

  return {
    items: rows.map(toTxn),
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

// ── Manual stock adjustment ──────────────────────────────────────────────────

/**
 * Apply a manual stock movement through the inventory ledger. Two shapes:
 *   • delta — a signed change of a given `type` (RESTOCK/RETURN/CANCELLATION add;
 *     ADJUSTMENT may be ±). The zero/sign rules are enforced by the validator.
 *   • set   — set stock to an absolute count. We read current stock inside the
 *     txn, compute the delta, and record it as an ADJUSTMENT with a compare-and-
 *     set guard (`expectedStock`) so a concurrent change is rejected, never
 *     silently clobbered. A no-op (delta 0) is a 422.
 *
 * The mutation runs inside one transaction (Neon-generous timeouts) so the stock
 * change and its ledger row commit together. The audit row is written after
 * commit (best-effort — never blocks or rolls back the adjustment).
 */
export async function adjustStock(input: AdjustInput, adminId?: string) {
  const { variantId } = input;

  const result = await prisma.$transaction(
    async (tx) => {
      if (input.mode === 'delta') {
        return recordInventoryChange(tx, {
          variantId,
          type: input.type,
          quantityChanged: input.quantity,
          reason: input.reason,
          adminId: adminId ?? null,
        });
      }

      // mode === 'set'
      const current = await tx.productVariant.findUnique({
        where: { id: variantId },
        select: { stock: true },
      });
      if (!current) {
        throw ApiError.notFound('Variant not found');
      }
      const delta = input.newStock - current.stock;
      if (delta === 0) {
        throw ApiError.unprocessable('Stock is already at that level.');
      }
      return recordInventoryChange(tx, {
        variantId,
        type: InventoryTxnType.ADJUSTMENT,
        quantityChanged: delta,
        reason: input.reason,
        adminId: adminId ?? null,
        expectedStock: current.stock,
      });
    },
    { maxWait: 15_000, timeout: 30_000 },
  );

  await logAudit({
    adminId,
    action: 'inventory.adjust',
    entityType: 'ProductVariant',
    entityId: variantId,
    meta: {
      mode: input.mode,
      type: input.mode === 'delta' ? input.type : 'ADJUSTMENT',
      previousStock: result.previousStock,
      newStock: result.newStock,
      quantityChanged: result.transaction.quantityChanged,
    },
  });

  // Reuse the admin variant DTO (product info, lowStock flag, Decimal→number).
  const variant = await getVariant(variantId);
  return { variant, transaction: result.transaction };
}
