import { z } from 'zod';

/**
 * ADMIN shipment-field edits. Every field is optional, but at least one must be
 * present (enforced by `.refine`). `estimatedArrival` is coerced from an ISO
 * string. Shipment **status** and **coordinates** are NOT editable here — those
 * are owned by the fulfillment state-machine (admin.order.service.ts).
 */
export const updateShipmentSchema = z
  .object({
    courier: z.string().trim().min(1).max(80).optional(),
    trackingCode: z.string().trim().min(1).max(80).optional(),
    estimatedArrival: z.coerce.date().optional(),
  })
  .refine((v) => v.courier !== undefined || v.trackingCode !== undefined || v.estimatedArrival !== undefined, {
    message: 'Provide at least one field to update (courier, trackingCode, or estimatedArrival).',
  });

export type UpdateShipmentBody = z.infer<typeof updateShipmentSchema>;
