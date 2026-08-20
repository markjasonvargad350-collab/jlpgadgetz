import { Prisma, InventoryTxnType } from '@prisma/client';
import { ApiError } from '../utils/ApiError';

export interface InventoryChange {
  variantId: string;
  type: InventoryTxnType;
  /** Signed delta: +RESTOCK/RETURN/CANCELLATION, −SALE, ± ADJUSTMENT. */
  quantityChanged: number;
  reason?: string;
  orderId?: string | null;
  adminId?: string | null;
  /**
   * Optional compare-and-set guard. When provided, the change only applies if
   * on-hand stock is *still exactly* this value — otherwise it's rejected as a
   * conflict (someone moved the stock between the caller's read and this write).
   * Used by manual "set to an absolute count" adjustments so they are race-safe
   * too. Leave undefined (the default) for plain increments/decrements.
   */
  expectedStock?: number;
}

/**
 * The ONE sanctioned way to mutate variant stock. Applies the signed delta as an
 * ATOMIC, guarded relative update and appends the matching `InventoryTransaction`
 * — both on the provided transaction client so the stock change and the ledger
 * row commit together. Every RESTOCK / SALE / RETURN / ADJUSTMENT / CANCELLATION
 * flows through here, which keeps the ledger reconciled with on-hand stock
 * (invariant: Σ quantityChanged == stock).
 *
 * Concurrency-safe by construction. Rather than read-then-write an absolute
 * value (which loses updates under READ COMMITTED — two sales for the last unit
 * could both read stock=1 and both write 0, overselling by one), it issues a
 * single `UPDATE … SET stock = stock + delta WHERE …guard`. When a concurrent
 * writer unblocks, Postgres re-evaluates the column-referencing guard against
 * the freshly committed row (EvalPlanQual), so a racing oversell — or a
 * compare-and-set whose expected value no longer holds — matches ZERO rows and
 * is rejected instead of silently clobbering stock.
 */
export async function recordInventoryChange(tx: Prisma.TransactionClient, change: InventoryChange) {
  const where: Prisma.ProductVariantWhereInput = { id: change.variantId };
  if (change.expectedStock !== undefined) {
    // Compare-and-set: apply only if stock is still exactly what the caller read.
    where.stock = change.expectedStock;
  } else if (change.quantityChanged < 0) {
    // Never drive stock negative (guards SALE and any negative ADJUSTMENT).
    where.stock = { gte: -change.quantityChanged };
  }

  const rows = await tx.productVariant.updateManyAndReturn({
    where,
    data: { stock: { increment: change.quantityChanged } },
    select: { id: true, stock: true, sku: true },
  });

  if (rows.length === 0) {
    // The guarded update matched nothing. Re-read to return a precise, honest
    // error: variant gone, stock moved under a compare-and-set, or oversell.
    const variant = await tx.productVariant.findUnique({
      where: { id: change.variantId },
      select: { id: true, stock: true, sku: true },
    });
    if (!variant) {
      throw ApiError.notFound('Variant not found');
    }
    if (change.expectedStock !== undefined && variant.stock !== change.expectedStock) {
      throw ApiError.conflict('Stock changed since you loaded it. Please retry.', {
        sku: variant.sku,
        expectedStock: change.expectedStock,
        actualStock: variant.stock,
      });
    }
    throw ApiError.conflict('Insufficient stock for this change', {
      sku: variant.sku,
      previousStock: variant.stock,
      quantityChanged: change.quantityChanged,
    });
  }

  // We hold this row's write lock across the return, so newStock is authoritative
  // and previousStock is exact by subtraction (integer math — no float drift).
  const newStock = rows[0].stock;
  const previousStock = newStock - change.quantityChanged;

  const transaction = await tx.inventoryTransaction.create({
    data: {
      variantId: change.variantId,
      type: change.type,
      previousStock,
      quantityChanged: change.quantityChanged,
      newStock,
      reason: change.reason,
      orderId: change.orderId ?? null,
      adminId: change.adminId ?? null,
    },
  });

  return { previousStock, newStock, transaction };
}
