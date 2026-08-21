/**
 * Installment business rules — the SERVER's single source of truth.
 *
 * JLP offers plain **price ÷ months** installments with an optional down
 * payment. There is deliberately NO interest, service fee, or financing charge
 * (we don't invent legal/financing terms): the sum of the monthly amounts always
 * equals the principal (price − down payment) to the centavo.
 *
 * The client may PREVIEW a monthly figure for UX, but every plan's money is
 * (re)computed here at apply time from the DB price — never trusted from the
 * client. All amounts are Prisma.Decimal (never floats).
 */
import { Prisma } from '@prisma/client';
import { money } from '../utils/money';

/** Selectable terms, in months. Not stored in the DB — this list is authoritative. */
export const INSTALLMENT_TERMS = [3, 6, 9, 12] as const;
export type InstallmentTerm = (typeof INSTALLMENT_TERMS)[number];

/** True when `n` is one of the allowed terms. */
export function isValidTerm(n: number): n is InstallmentTerm {
  return (INSTALLMENT_TERMS as readonly number[]).includes(n);
}

export interface ScheduleRow {
  /** 1-based month index (1..termMonths). */
  sequence: number;
  amountDue: Prisma.Decimal;
}

export interface InstallmentComputation {
  /** price − downPayment. Must be > 0 for a valid plan. */
  principal: Prisma.Decimal;
  /** The headline monthly = round2(principal ÷ term). The final row may differ by the rounding remainder. */
  monthlyAmount: Prisma.Decimal;
  /** Per-month schedule; Σ amountDue === principal exactly (last row absorbs rounding). */
  rows: ScheduleRow[];
}

/**
 * Interest-free schedule: monthly = principal ÷ termMonths. Each month is
 * round2(principal/term) except the LAST, which is `principal − Σ(earlier rows)`
 * so the schedule reconciles to the principal exactly (no lost/created centavos).
 *
 * The caller must have already validated price/term/downPayment (see the
 * installment validator + service); this is pure arithmetic on Decimals.
 */
export function computeSchedule(
  price: Prisma.Decimal,
  termMonths: number,
  downPayment: Prisma.Decimal,
): InstallmentComputation {
  const principal = price.sub(downPayment);
  const monthlyAmount = money(principal.toNumber() / termMonths);

  const rows: ScheduleRow[] = [];
  let allocated = new Prisma.Decimal(0);
  for (let i = 1; i <= termMonths; i++) {
    const isLast = i === termMonths;
    const amountDue = isLast ? principal.sub(allocated) : monthlyAmount;
    rows.push({ sequence: i, amountDue });
    allocated = allocated.add(amountDue);
  }
  return { principal, monthlyAmount, rows };
}
