import { z } from 'zod';

// ── Inventory list (variant-centric stock view) ──────────────────────────────

export const inventoryListQuerySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  status: z.enum(['all', 'in', 'low', 'out']).default('all'),
  category: z.string().trim().min(1).max(60).optional(),
  sort: z.enum(['stock_asc', 'stock_desc', 'sku', 'updated']).default('stock_asc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// ── Inventory ledger (transactions) ──────────────────────────────────────────
// `type` accepts ALL five values here (SALE is a valid *filter* even though it is
// a forbidden *input* on the adjust endpoint).

export const transactionsQuerySchema = z.object({
  variantId: z.string().trim().min(1).max(60).optional(),
  type: z.enum(['RESTOCK', 'SALE', 'RETURN', 'ADJUSTMENT', 'CANCELLATION']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// ── Manual stock adjustment ──────────────────────────────────────────────────
// A discriminated union on `mode`. Members are kept PURE (no per-member refine,
// which historically breaks discriminatedUnion typing); the one cross-field rule
// lives in a single top-level superRefine.

const reasonField = z.string().trim().max(500).optional();
const variantIdField = z.string().trim().min(1).max(60);

export const adjustSchema = z
  .discriminatedUnion('mode', [
    z.object({
      mode: z.literal('delta'),
      variantId: variantIdField,
      // SALE is excluded by construction — sales only happen through orders.
      type: z.enum(['RESTOCK', 'RETURN', 'CANCELLATION', 'ADJUSTMENT']),
      quantity: z.number().int().min(-1_000_000).max(1_000_000),
      reason: reasonField,
    }),
    z.object({
      mode: z.literal('set'),
      variantId: variantIdField,
      newStock: z.number().int().min(0).max(1_000_000),
      reason: reasonField,
    }),
  ])
  .superRefine((v, ctx) => {
    if (v.mode === 'delta') {
      if (v.quantity === 0) {
        ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Quantity cannot be zero' });
      }
      // Restock/return/cancellation only ever add stock; only ADJUSTMENT may be ±.
      if (v.type !== 'ADJUSTMENT' && v.quantity <= 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['quantity'],
          message: 'Restock, return, and cancellation must add stock (quantity > 0)',
        });
      }
    }
  });

export type InventoryListQuery = z.infer<typeof inventoryListQuerySchema>;
export type TransactionsQuery = z.infer<typeof transactionsQuerySchema>;
export type AdjustInput = z.infer<typeof adjustSchema>;
