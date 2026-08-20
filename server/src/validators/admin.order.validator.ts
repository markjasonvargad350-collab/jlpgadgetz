import { z } from 'zod';
import { OrderStatus, PaymentStatus } from '@prisma/client';

// ── Order list (admin) ───────────────────────────────────────────────────────
// `z.enum(PrismaEnum)` is the Zod-4 form proven in order.validator.ts.

export const adminOrderListQuerySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  status: z.enum(OrderStatus).optional(),
  paymentStatus: z.enum(PaymentStatus).optional(),
  // Inclusive Manila calendar-day bounds (see utils/time.ts). Coerced from
  // `?from=2026-08-20` style query strings.
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sort: z.enum(['placed_desc', 'placed_asc', 'total_desc', 'total_asc']).default('placed_desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const orderNumberParamSchema = z.object({
  orderNumber: z.string().trim().min(1).max(40),
});

// The client sends ONLY the target status; every transition rule is enforced
// server-side against ALLOWED_TRANSITIONS in the service.
export const updateOrderStatusSchema = z.object({
  status: z.enum(OrderStatus),
});

export type AdminOrderListQuery = z.infer<typeof adminOrderListQuerySchema>;
export type UpdateOrderStatusBody = z.infer<typeof updateOrderStatusSchema>;
