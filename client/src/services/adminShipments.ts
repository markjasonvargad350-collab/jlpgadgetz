import { http } from './http';
import type { OrderDTO } from '../types/order';

/**
 * ADMIN shipment-field edits. Only the human-managed fields are editable here —
 * courier, tracking code, and estimated arrival. Shipment **status** and
 * **coordinates** are owned by the fulfillment state-machine (advancing an
 * order moves them), never patched directly. The endpoint is ADMIN-only
 * (STAFF → 403) and returns the refreshed `{order}` like the order services.
 */
export interface ShipmentUpdate {
  courier?: string;
  trackingCode?: string;
  /** ISO date string; the server coerces it to a Date. */
  estimatedArrival?: string;
}

/** PATCH /api/admin/shipments/:orderNumber — edit courier / tracking / ETA. */
export async function updateShipment(orderNumber: string, patch: ShipmentUpdate): Promise<OrderDTO> {
  const { data } = await http.patch<{ order: OrderDTO }>(
    `/admin/shipments/${encodeURIComponent(orderNumber)}`,
    patch,
  );
  return data.order;
}
