import { Prisma } from '@prisma/client';

/**
 * Build a DECIMAL(12,2) money value from a number, rounding to 2 places so no
 * binary-float artifacts ever reach the database. Mirrors the seed's helper.
 */
export const money = (n: number): Prisma.Decimal => new Prisma.Decimal(n.toFixed(2));

const phpFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

/** Format a peso amount for human-facing text, e.g. 89990 → "₱89,990". */
export const formatPHP = (amount: number): string => phpFormatter.format(amount);
