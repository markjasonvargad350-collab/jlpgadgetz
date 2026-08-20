/**
 * Order-domain business rules. Kept in one place so pricing/limits are auditable
 * and easy to tune. All money is in PHP (₱), whole pesos.
 *
 * These values are the SERVER's source of truth. The client may show an
 * estimated delivery fee for UX, but the authoritative total is always the one
 * computed here at order time.
 */

/** Flat nationwide delivery fee, in pesos, applied below the free-shipping bar. */
export const DELIVERY_FEE = 150;

/** Orders whose subtotal reaches this (pesos) ship free. */
export const FREE_DELIVERY_THRESHOLD = 20_000;

/** Max units of a single variant allowed in one order (server still re-checks stock). */
export const MAX_ORDER_QUANTITY_PER_ITEM = 10;

/** Max distinct line items in one order (guards against oversized payloads). */
export const MAX_ORDER_ITEMS = 50;

/**
 * Delivery fee for a given subtotal. Free once the subtotal clears the
 * free-shipping threshold; a flat fee otherwise.
 */
export function computeDeliveryFee(subtotal: number): number {
  return subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
}
