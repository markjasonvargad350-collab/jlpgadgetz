import { z } from 'zod';
import { PaymentMethod, InstallmentStatus } from '@prisma/client';
import { INSTALLMENT_TERMS } from '../config/installment';

// Local email/phone shapes (Zod 4 dropped `.email()`) — identical to order/trade-in.
const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Email is required')
  .max(254)
  .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, 'Enter a valid email address');

const phoneField = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ''))
  .pipe(z.string().regex(/^(?:\+63|0)9\d{9}$/, 'Enter a valid PH mobile number (e.g. 0917 123 4567)'));

// Terms are a fixed set; reject anything else up front (the service re-checks too).
const termField = z.coerce
  .number()
  .int()
  .refine((n) => (INSTALLMENT_TERMS as readonly number[]).includes(n), {
    message: `Term must be one of: ${INSTALLMENT_TERMS.join(', ')} months`,
  });

const moneyField = z.number().min(0).max(100_000_000);

// ── Public quote (preview) ────────────────────────────────────────────────────

export const quoteInstallmentSchema = z.object({
  variantId: z.string().trim().min(1).max(60),
  termMonths: termField,
  downPayment: z.coerce.number().min(0).max(100_000_000).default(0),
});

export type QuoteInstallmentQuery = z.infer<typeof quoteInstallmentSchema>;

// ── Public application ─────────────────────────────────────────────────────────

export const createInstallmentSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(2, 'Name is required').max(80),
    email: emailField,
    phone: phoneField,
  }),
  variantId: z.string().trim().min(1).max(60),
  termMonths: termField,
  downPayment: moneyField.default(0),
  branchId: z.string().trim().min(1).max(60).optional(),
});

export type CreateInstallmentBody = z.infer<typeof createInstallmentSchema>;

// ── Admin management ─────────────────────────────────────────────────────────

export const adminInstallmentQuerySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  status: z.enum(InstallmentStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// The client sends only the target status; transitions are enforced server-side.
export const updateInstallmentStatusSchema = z.object({
  status: z.enum(InstallmentStatus),
  staffNotes: z.string().trim().max(2000).nullable().optional(),
});

// Record a payment against one schedule row. `amount` must be > 0 and is capped
// at the row's remaining balance server-side (no overpay). Additive only.
export const recordPaymentSchema = z.object({
  amount: z.number().positive('Amount must be greater than zero').max(100_000_000),
  method: z.enum(PaymentMethod).optional(),
  reference: z.string().trim().max(120).optional(),
});

export const installmentIdParamSchema = z.object({ id: z.string().trim().min(1).max(60) });
export const installmentPaymentParamSchema = z.object({
  id: z.string().trim().min(1).max(60),
  paymentId: z.string().trim().min(1).max(60),
});

export type AdminInstallmentQueryInput = z.infer<typeof adminInstallmentQuerySchema>;
export type UpdateInstallmentStatusInput = z.infer<typeof updateInstallmentStatusSchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
