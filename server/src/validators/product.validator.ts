import { z } from 'zod';

/** Query-string booleans arrive as the strings "true"/"false". */
const boolParam = z.enum(['true', 'false']).transform((v) => v === 'true');

export const productQuerySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  category: z.string().trim().min(1).max(60).optional(),
  featured: boolParam.optional(),
  bestSeller: boolParam.optional(),
  newArrival: boolParam.optional(),
  deal: boolParam.optional(),
  installment: boolParam.optional(),
  inStock: boolParam.optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'bestselling', 'name']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(12),
});

export type ProductQueryInput = z.infer<typeof productQuerySchema>;

export const productParamsSchema = z.object({
  idOrSlug: z.string().trim().min(1).max(120),
});
