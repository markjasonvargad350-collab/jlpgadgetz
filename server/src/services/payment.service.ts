import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { formatPHP } from '../utils/money';

/**
 * Result of initiating payment for an order. `status` is what the payment starts
 * as, `reference` is a gateway/txn id (null for COD), and `instructions` is
 * human-facing guidance shown on the confirmation page.
 */
export interface PaymentInitResult {
  status: PaymentStatus;
  reference: string | null;
  instructions: string;
}

/**
 * Human-facing payment guidance. Pure (depends only on method + amount) so it
 * can be re-derived when reading an order for display without persisting the
 * text — see the order DTO mapper.
 */
export function paymentInstructions(method: PaymentMethod, amount: number): string {
  if (method === PaymentMethod.COD) {
    return `Pay ${formatPHP(amount)} in cash when your order is delivered.`;
  }
  const label = method === PaymentMethod.GCASH ? 'GCash' : 'bank transfer';
  return (
    `This demo store simulates ${label} payments — no real transfer is made. ` +
    `Your order is recorded as awaiting payment and is confirmed by our team before dispatch.`
  );
}

/**
 * A payment provider abstracts *how* money is collected so the order system
 * never touches gateway specifics. A real provider (PayMongo, Stripe, GCash API)
 * can implement this later WITHOUT changing order creation — and, per our
 * security rules, any secret keys it needs live only in server env, never the
 * client.
 */
export interface PaymentProvider {
  initiate(method: PaymentMethod, amount: number, orderNumber: string): PaymentInitResult;
}

/**
 * The default provider for this build. It is honest about being a simulation —
 * it never marks money as actually received. Every method starts PENDING:
 *   • COD           → collected in cash on delivery.
 *   • GCASH / BANK  → recorded as awaiting confirmation; an admin confirms
 *                     receipt in the dashboard (Phase 8). No real transfer,
 *                     no fake "paid" state, no invented merchant account.
 */
export class SimulatedPaymentProvider implements PaymentProvider {
  initiate(method: PaymentMethod, amount: number, orderNumber: string): PaymentInitResult {
    return {
      status: PaymentStatus.PENDING,
      reference: method === PaymentMethod.COD ? null : `SIM-${orderNumber}`,
      instructions: paymentInstructions(method, amount),
    };
  }
}

/** Singleton used by the order service. Swap this line to change providers. */
export const paymentProvider: PaymentProvider = new SimulatedPaymentProvider();
