import { z } from 'zod';
import { PaymentMethod } from '@prisma/client';
import { MAX_ORDER_ITEMS, MAX_ORDER_QUANTITY_PER_ITEM } from '../config/order';

// Zod 4 dropped `.email()`; validate shape with a bounded regex.
const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Email is required')
  .max(254)
  .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, 'Enter a valid email address');

// PH mobile: +639XXXXXXXXX or 09XXXXXXXXX. Spaces/dashes are stripped first.
const phoneField = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ''))
  .pipe(z.string().regex(/^(?:\+63|0)9\d{9}$/, 'Enter a valid PH mobile number (e.g. 0917 123 4567)'));

const orderItemSchema = z.object({
  variantId: z.string().trim().min(1).max(40),
  quantity: z.coerce.number().int().min(1).max(MAX_ORDER_QUANTITY_PER_ITEM),
});

export const createOrderSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(2, 'Name is required').max(80),
    email: emailField,
    phone: phoneField,
  }),
  address: z.object({
    addressLine: z.string().trim().min(3, 'Street / house no. is required').max(160),
    barangay: z.string().trim().min(1, 'Barangay is required').max(80),
    city: z.string().trim().min(1, 'City / municipality is required').max(80),
    province: z.string().trim().min(1, 'Province is required').max(80),
    postalCode: z
      .string()
      .trim()
      .regex(/^\d{4}$/, 'PH postal code is 4 digits'),
    addressNote: z.string().trim().max(200).optional(),
  }),
  paymentMethod: z.enum(PaymentMethod),
  items: z.array(orderItemSchema).min(1, 'Your cart is empty').max(MAX_ORDER_ITEMS),
});

export type CreateOrderBody = z.infer<typeof createOrderSchema>;

export const orderParamsSchema = z.object({
  orderNumber: z.string().trim().min(1).max(40),
});

export const orderLookupQuerySchema = z.object({
  email: emailField,
});
