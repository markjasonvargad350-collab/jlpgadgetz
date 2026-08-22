import type { ProductCondition } from '../types/api';

/**
 * Human labels for the server's `ProductCondition` enum. JLP sells both
 * brand-new and pre-owned units, so condition is shown wherever a variant is —
 * cards, the product page, the installment picker and the trade-in form.
 */
export const CONDITION_LABELS: Record<ProductCondition, string> = {
  NEW: 'Brand new',
  STANDARD: 'Standard',
  OPEN_BOX: 'Open box',
  PREOWNED: 'Pre-owned',
  REFURBISHED: 'Refurbished',
};

/**
 * Order used by every condition selector, best-first. Kept separate from the
 * label map because object key order isn't a contract.
 */
export const CONDITION_ORDER: readonly ProductCondition[] = [
  'NEW',
  'STANDARD',
  'OPEN_BOX',
  'REFURBISHED',
  'PREOWNED',
] as const;

/**
 * The conditions a customer may claim for their OWN device on the trade-in form.
 * "Standard" is JLP's own grading for a unit the shop has opened and tested, so
 * it is deliberately absent here — the server rejects it too
 * (server/src/validators/tradein.validator.ts).
 */
export const TRADE_IN_CONDITION_ORDER: readonly ProductCondition[] = [
  'NEW',
  'OPEN_BOX',
  'REFURBISHED',
  'PREOWNED',
] as const;

/** `true` for everything except a sealed brand-new unit. */
export function isPreOwnedCondition(condition: ProductCondition): boolean {
  return condition !== 'NEW';
}

/** Sort conditions into `CONDITION_ORDER`; unknown values sink to the end. */
export function sortConditions(conditions: ProductCondition[]): ProductCondition[] {
  const rank = (c: ProductCondition) => {
    const i = CONDITION_ORDER.indexOf(c);
    return i === -1 ? CONDITION_ORDER.length : i;
  };
  return [...conditions].sort((a, b) => rank(a) - rank(b));
}
