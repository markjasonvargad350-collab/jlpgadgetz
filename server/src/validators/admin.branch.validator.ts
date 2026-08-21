import { z } from 'zod';

// Zod 4 dropped `.email()` — validate shape with a bounded regex (matches
// order.validator's approach). Branch email/phone are optional business contacts.
const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, 'Enter a valid email address');

const latField = z.number().min(-90).max(90);
const lngField = z.number().min(-180).max(180);

export const createBranchSchema = z.object({
  name: z.string().trim().min(1, 'Branch name is required').max(120),
  slug: z.string().trim().min(1).max(120).optional(),
  city: z.string().trim().max(120).optional(),
  province: z.string().trim().max(120).optional(),
  addressLine: z.string().trim().max(240).optional(),
  phone: z.string().trim().max(40).optional(),
  email: emailField.optional(),
  hours: z.string().trim().max(240).optional(),
  lat: latField.optional(),
  lng: lngField.optional(),
  position: z.number().int().min(0).max(1000).optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

export const updateBranchSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    slug: z.string().trim().min(1).max(120).optional(),
    city: z.string().trim().max(120).nullable().optional(),
    province: z.string().trim().max(120).nullable().optional(),
    addressLine: z.string().trim().max(240).nullable().optional(),
    phone: z.string().trim().max(40).nullable().optional(),
    email: emailField.nullable().optional(),
    hours: z.string().trim().max(240).nullable().optional(),
    lat: latField.nullable().optional(),
    lng: lngField.nullable().optional(),
    position: z.number().int().min(0).max(1000).optional(),
    isActive: z.boolean().optional(),
    isDefault: z.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'Provide at least one field to update' });

export const adminBranchQuerySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  active: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export const branchIdParamSchema = z.object({ id: z.string().trim().min(1).max(60) });

export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
export type AdminBranchQueryInput = z.infer<typeof adminBranchQuerySchema>;
