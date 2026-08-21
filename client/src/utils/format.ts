const php = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

/** Peso formatter that keeps centavos — for installment amounts, which divide. */
const phpExact = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format a peso amount, e.g. 89990 → "₱89,990". */
export function formatPHP(amount: number): string {
  return php.format(amount);
}

/**
 * Format a peso amount to the centavo, e.g. 8332.5 → "₱8,332.50". Use for
 * installment monthlies and schedule rows, where dividing a price by a term
 * legitimately produces centavos and rounding the display would hide them.
 */
export function formatPHPExact(amount: number): string {
  return phpExact.format(amount);
}

/** Format a price range; collapses to a single value when from === to. */
export function formatPriceRange(from: number, to: number): string {
  return from === to ? formatPHP(from) : `${formatPHP(from)} – ${formatPHP(to)}`;
}

/**
 * One-line location for a branch. Prefers the real street address when the owner
 * has entered one, otherwise falls back to city/province — we never synthesise a
 * street for branches that don't have one on record.
 */
export function formatBranchLocation(branch: {
  addressLine?: string | null;
  city?: string | null;
  province?: string | null;
}): string {
  if (branch.addressLine) return branch.addressLine;
  return [branch.city, branch.province].filter(Boolean).join(', ');
}

// ── Dates ────────────────────────────────────────────────────────────────────
// All admin dates render in Philippine time. PH observes no DST, so Asia/Manila
// is a fixed +08:00 — bucketing and display always agree. Inputs may be an ISO
// string (the JSON wire form), a Date, or an epoch.

type DateInput = string | number | Date;

const dateFmt = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});
const dateTimeFmt = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});
const dateShortFmt = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila',
  month: 'short',
  day: 'numeric',
});
// en-CA yields ISO-ordered yyyy-MM-dd — exactly what <input type="date"> wants —
// evaluated in Manila time so it agrees with formatDate on the round-trip.
const dateInputFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** e.g. "20 Aug 2026". */
export function formatDate(input: DateInput): string {
  return dateFmt.format(new Date(input));
}

/** e.g. "20 Aug 2026, 3:45 PM". */
export function formatDateTime(input: DateInput): string {
  return dateTimeFmt.format(new Date(input));
}

/** Compact axis/tick label, e.g. "20 Aug". */
export function formatDateShort(input: DateInput): string {
  return dateShortFmt.format(new Date(input));
}

/** Manila-local `yyyy-MM-dd` for a `<input type="date">` value. */
export function toDateInputValue(input: DateInput): string {
  return dateInputFmt.format(new Date(input));
}
