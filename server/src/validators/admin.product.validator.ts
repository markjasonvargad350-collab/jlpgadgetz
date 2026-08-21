import { z } from 'zod';

const statusEnum = z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']);
const conditionEnum = z.enum(['NEW', 'OPEN_BOX', 'PREOWNED', 'REFURBISHED']);
const hexColor = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'Use a #RRGGBB hex color');
// Battery health only makes sense for pre-owned/refurbished units (0–100%).
const batteryHealthField = z.number().int().min(0).max(100);

export const imageInputSchema = z.object({
  url: z.string().trim().min(1).max(1000),
  alt: z.string().trim().max(200).optional(),
  position: z.number().int().min(0).max(100).optional(),
});

export const variantCreateSchema = z.object({
  sku: z.string().trim().min(1).max(60),
  storage: z.string().trim().min(1).max(40),
  color: z.string().trim().min(1).max(60),
  colorHex: hexColor.optional(),
  price: z.number().positive().max(100_000_000),
  initialStock: z.number().int().min(0).max(1_000_000).optional(),
  lowStockThreshold: z.number().int().min(0).max(100_000).optional(),
  imageUrl: z.string().trim().max(1000).optional(),
  isActive: z.boolean().optional(),
  // Pre-owned support — defaults to NEW when omitted.
  condition: conditionEnum.optional(),
  batteryHealth: batteryHealthField.optional(),
  conditionNote: z.string().trim().max(500).optional(),
});

export const createProductSchema = z.object({
  name: z.string().trim().min(1).max(160),
  slug: z.string().trim().min(1).max(120).optional(),
  brand: z.string().trim().min(1).max(60).optional(),
  model: z.string().trim().max(80).optional(),
  description: z.string().trim().min(1).max(5000),
  highlights: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  basePrice: z.number().positive().max(100_000_000),
  discountPct: z.number().int().min(0).max(100).optional(),
  status: statusEnum.optional(),
  isFeatured: z.boolean().optional(),
  isNewArrival: z.boolean().optional(),
  isBestSeller: z.boolean().optional(),
  isDeal: z.boolean().optional(),
  // Listing-level "Pre-owned" flag — merchandising only; per-unit state lives on
  // each variant's `condition`.
  isPreOwned: z.boolean().optional(),
  releaseYear: z.number().int().min(2000).max(2100).optional(),
  categoryId: z.string().trim().min(1),
  // Per-product installment opt-in + minimum down payment (% of price, 0–90).
  installmentAvailable: z.boolean().optional(),
  installmentMinDownPct: z.number().int().min(0).max(90).optional(),
  images: z.array(imageInputSchema).max(12).optional(),
  variants: z.array(variantCreateSchema).max(60).optional(),
});

export const updateProductSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    slug: z.string().trim().min(1).max(120).optional(),
    brand: z.string().trim().min(1).max(60).optional(),
    model: z.string().trim().max(80).nullable().optional(),
    description: z.string().trim().min(1).max(5000).optional(),
    highlights: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
    basePrice: z.number().positive().max(100_000_000).optional(),
    discountPct: z.number().int().min(0).max(100).optional(),
    status: statusEnum.optional(),
    isFeatured: z.boolean().optional(),
    isNewArrival: z.boolean().optional(),
    isBestSeller: z.boolean().optional(),
    isDeal: z.boolean().optional(),
    isPreOwned: z.boolean().optional(),
    releaseYear: z.number().int().min(2000).max(2100).nullable().optional(),
    categoryId: z.string().trim().min(1).optional(),
    installmentAvailable: z.boolean().optional(),
    installmentMinDownPct: z.number().int().min(0).max(90).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'Provide at least one field to update' });

export const variantUpdateSchema = z
  .object({
    sku: z.string().trim().min(1).max(60).optional(),
    storage: z.string().trim().min(1).max(40).optional(),
    color: z.string().trim().min(1).max(60).optional(),
    colorHex: hexColor.nullable().optional(),
    price: z.number().positive().max(100_000_000).optional(),
    lowStockThreshold: z.number().int().min(0).max(100_000).optional(),
    imageUrl: z.string().trim().max(1000).nullable().optional(),
    isActive: z.boolean().optional(),
    condition: conditionEnum.optional(),
    batteryHealth: batteryHealthField.nullable().optional(),
    conditionNote: z.string().trim().max(500).nullable().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'Provide at least one field to update' });

export const adminProductQuerySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  status: statusEnum.optional(),
  category: z.string().trim().min(1).max(60).optional(),
  sort: z.enum(['newest', 'name', 'price_asc', 'price_desc']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const idParamSchema = z.object({ id: z.string().trim().min(1).max(60) });
export const imageIdParamSchema = z.object({ imageId: z.string().trim().min(1).max(60) });

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type VariantCreateInput = z.infer<typeof variantCreateSchema>;
export type VariantUpdateInput = z.infer<typeof variantUpdateSchema>;
export type ImageInput = z.infer<typeof imageInputSchema>;
export type AdminProductQueryInput = z.infer<typeof adminProductQuerySchema>;
