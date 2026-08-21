/**
 * Installment display rules — a PREVIEW-ONLY mirror of the server's
 * `server/src/config/installment.ts`.
 *
 * JLP installments are plain **price ÷ months** with an optional down payment:
 * no interest, no service fee, no financing charge. Nothing here is
 * authoritative — the server recomputes every figure from the stored variant
 * price when a quote is requested and again when a plan is created. Use these
 * helpers only to keep a form responsive between quote round-trips.
 */

/** Selectable terms, in months. Must match the server's INSTALLMENT_TERMS. */
export const INSTALLMENT_TERMS = [3, 6, 9, 12] as const;

export type InstallmentTerm = (typeof INSTALLMENT_TERMS)[number];

/**
 * Optimistic monthly figure: (price − downPayment) ÷ months, rounded to
 * centavos. The server's schedule lets the FINAL month absorb the rounding
 * remainder, so a real schedule's last row can differ from this by a few
 * centavos. Display only — never submit this value.
 */
export function computeMonthly(price: number, termMonths: number, downPayment = 0): number {
  const principal = price - downPayment;
  if (!(termMonths > 0) || principal <= 0) return 0;
  return Math.round((principal / termMonths) * 100) / 100;
}

/** Smallest down payment a product accepts, from its minDownPct (0–90). */
export function minDownPayment(price: number, minDownPct: number): number {
  return Math.round(((price * minDownPct) / 100) * 100) / 100;
}
