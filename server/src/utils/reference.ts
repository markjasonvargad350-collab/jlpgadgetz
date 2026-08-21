/**
 * Human-facing daily reference numbers: `KIND-YYYYMMDD-####` (e.g.
 * `TRD-20260821-0003`). Mirrors order.service's `nextOrderNumber` scheme — the
 * sequence is (highest existing sequence for today) + 1, NOT a row count, so a
 * gap from a deleted/failed row can never cause the number to repeat.
 *
 * The Prisma `findFirst` query stays in each service (so it's fully typed
 * against that model's delegate); this module owns only the string math, which
 * is what's easy to get subtly wrong. Concurrent creates on the same day can
 * still read the same max and collide on the unique `reference` — the caller
 * retries on P2002, regenerating against the now-higher max (same as orders).
 */
import { manilaDateStamp } from './time';

/** Today's reference prefix in Manila time, e.g. `TRD-20260821-`. */
export function dailyReferencePrefix(kind: string, now: Date): string {
  return `${kind}-${manilaDateStamp(now)}-`;
}

/** Next reference for `prefix`, given today's highest existing reference (or null). */
export function nextReferenceFrom(prefix: string, lastReference: string | null): string {
  const lastSeq = lastReference ? Number(lastReference.slice(prefix.length)) : 0;
  const nextSeq = (Number.isFinite(lastSeq) ? lastSeq : 0) + 1;
  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}
