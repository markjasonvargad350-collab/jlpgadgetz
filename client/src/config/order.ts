/**
 * Client-side mirror of the server's order pricing rules
 * (server/src/config/order.ts). These drive the checkout ESTIMATE only — the
 * server always computes the authoritative fee and total at order time, and the
 * confirmation screen shows those server values. Keep in sync with the server.
 */
export const DELIVERY_FEE = 150;
export const FREE_DELIVERY_THRESHOLD = 20_000;

/** Estimated delivery fee for a subtotal; free once the threshold is cleared. */
export function estimateDeliveryFee(subtotal: number): number {
  return subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
}
