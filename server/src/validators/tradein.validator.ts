import { z } from 'zod';
import { ProductCondition, TradeInStatus } from '@prisma/client';

// Local copies of the email/phone shapes (Zod 4 dropped `.email()`), matching
// order.validator so guest contact validation is identical across features.
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

const batteryHealthField = z.number().int().min(0).max(100);

// A customer grades THEIR OWN phone here, so the shop's internal "Standard"
// grading tier is deliberately not on offer — it describes a unit JLP has tested
// and put on the shelf, which is not a thing a seller can claim about their own
// device. Kept derived from the Prisma enum so a rename fails the build.
const deviceConditionField = z.enum(ProductCondition).exclude(['STANDARD']);

// ── Public application ───────────────────────────────────────────────────────

export const createTradeInSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(2, 'Name is required').max(80),
    email: emailField,
    phone: phoneField,
  }),
  device: z.object({
    brand: z.string().trim().min(1, 'Device brand is required').max(60),
    model: z.string().trim().min(1, 'Device model is required').max(80),
    storage: z.string().trim().max(40).optional(),
    color: z.string().trim().max(60).optional(),
    condition: deviceConditionField.optional(), // defaults to PREOWNED server-side
    batteryHealth: batteryHealthField.optional(),
    imei: z.string().trim().max(20).optional(),
    hasBox: z.boolean().optional(),
    hasCharger: z.boolean().optional(),
    issues: z.string().trim().max(1000).optional(),
    photos: z.array(z.string().trim().min(1).max(1000)).max(8).optional(),
  }),
  branchId: z.string().trim().min(1).max(60).optional(),
});

export type CreateTradeInBody = z.infer<typeof createTradeInSchema>;

// ── Admin management ─────────────────────────────────────────────────────────

const valuationField = z.number().min(0, 'Value cannot be negative').max(100_000_000);

export const adminTradeInQuerySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  status: z.enum(TradeInStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// Staff may move the workflow forward AND/OR set the valuation. The valuation is
// ALWAYS entered by staff here — it is never derived/hardcoded. Transition rules
// are enforced server-side against ALLOWED_TRANSITIONS.
export const updateTradeInSchema = z
  .object({
    status: z.enum(TradeInStatus).optional(),
    quotedValue: valuationField.nullable().optional(),
    finalValue: valuationField.nullable().optional(),
    staffNotes: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'Provide at least one field to update' });

export const tradeInIdParamSchema = z.object({ id: z.string().trim().min(1).max(60) });

export type AdminTradeInQueryInput = z.infer<typeof adminTradeInQuerySchema>;
export type UpdateTradeInInput = z.infer<typeof updateTradeInSchema>;
