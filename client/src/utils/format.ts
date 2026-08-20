const php = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

/** Format a peso amount, e.g. 89990 → "₱89,990". */
export function formatPHP(amount: number): string {
  return php.format(amount);
}

/** Format a price range; collapses to a single value when from === to. */
export function formatPriceRange(from: number, to: number): string {
  return from === to ? formatPHP(from) : `${formatPHP(from)} – ${formatPHP(to)}`;
}
