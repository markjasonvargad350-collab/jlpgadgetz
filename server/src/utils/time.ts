/**
 * Asia/Manila calendar helpers.
 *
 * The Philippines observes **no DST** — the offset is a fixed +08:00 all year —
 * so a Manila calendar day is always exactly 24 hours and can be mapped to/from
 * UTC with a constant offset. That makes "start/end of a Manila day, expressed as
 * a UTC instant" exact arithmetic (no timezone library needed).
 *
 * Used by order-number generation, the admin orders date filter, and the reports
 * revenue-by-day series so every "day" boundary agrees across the back-office.
 */

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000; // UTC+08:00, no DST
const DAY_MS = 24 * 60 * 60 * 1000;

/** YYYYMMDD for the Manila calendar day containing `now`, regardless of server tz. */
export function manilaDateStamp(now: Date): string {
  // en-CA renders as YYYY-MM-DD; strip the dashes.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(now)
    .replace(/-/g, '');
}

/** The Manila wall-clock Y/M/D that the given UTC instant falls on. */
function manilaParts(instant: Date): { y: number; m: number; d: number } {
  const shifted = new Date(instant.getTime() + MANILA_OFFSET_MS);
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth(), d: shifted.getUTCDate() };
}

/** UTC instant of 00:00:00.000 (Manila) on the day that `instant` falls on. */
export function manilaStartOfDayUTC(instant: Date): Date {
  const { y, m, d } = manilaParts(instant);
  return new Date(Date.UTC(y, m, d, 0, 0, 0, 0) - MANILA_OFFSET_MS);
}

/** UTC instant of 23:59:59.999 (Manila) on the day that `instant` falls on. */
export function manilaEndOfDayUTC(instant: Date): Date {
  const { y, m, d } = manilaParts(instant);
  return new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - MANILA_OFFSET_MS);
}

/**
 * UTC instant of the start of the Manila day `daysAgo` days before today.
 * `daysAgo = 0` → start of today (Manila); `6` → start of the day 6 days ago.
 * No-DST means every step back is exactly 24h.
 */
export function manilaDayStartUTC(daysAgo = 0): Date {
  const todayStart = manilaStartOfDayUTC(new Date());
  return new Date(todayStart.getTime() - daysAgo * DAY_MS);
}

/**
 * Convert inclusive Manila calendar-day boundaries to a UTC `{gte, lte}` range.
 *   • `from` → 00:00:00.000 (Manila) of that day
 *   • `to`   → 23:59:59.999 (Manila) of that day
 * A bare date like `2026-08-20` (coerced to UTC midnight) is interpreted as the
 * Manila day it names. Either bound may be omitted.
 */
export function manilaRangeToUtc(from?: Date, to?: Date): { gte?: Date; lte?: Date } {
  const range: { gte?: Date; lte?: Date } = {};
  if (from) range.gte = manilaStartOfDayUTC(from);
  if (to) range.lte = manilaEndOfDayUTC(to);
  return range;
}
