/**
 * Client mirror of the server's delivery milestones. Drives the tracking
 * timeline order, the map's solid-vs-dashed route split, and shared status
 * labels. Coordinates themselves come from the API (the server owns the
 * simulated geo); this file only needs the milestone ORDERING + labels.
 *
 * ⚠️  SIMULATED — the delivery map is client-side easing over a fixed reference
 * route, never real GPS.
 */
import type { OrderStatus } from '../types/order';

/** Ordered forward milestones (no CANCELLED — a terminal off-route state). */
export const MILESTONE_ORDER: OrderStatus[] = [
  'RECEIVED',
  'PROCESSING',
  'PACKED',
  'SHIPPED',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
];

/**
 * Position of a status along the route, or -1 for off-route states
 * (CANCELLED). Used to split the traversed leg (solid) from the remainder
 * (dashed) and to know how far the courier has progressed.
 */
export function milestoneIndex(status: OrderStatus): number {
  return MILESTONE_ORDER.indexOf(status);
}

/** Shared human labels for a fulfillment status (matches the admin badges). */
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  RECEIVED: 'Received',
  PROCESSING: 'Processing',
  PACKED: 'Packed',
  SHIPPED: 'Shipped',
  IN_TRANSIT: 'In transit',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

/** The honesty label shown on every delivery map. */
export const SIMULATED_LABEL = 'Simulated movement · not live GPS';
