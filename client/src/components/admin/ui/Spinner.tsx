/** A small spinner. `size` is the diameter in px; `tone` sets the palette
 *  ("brand" on light surfaces, "light" on the brand-gradient button). */
export function Spinner({
  size = 20,
  tone = 'brand',
  className = '',
}: {
  size?: number;
  tone?: 'brand' | 'light';
  className?: string;
}) {
  const palette = tone === 'light' ? 'border-white/40 border-t-white' : 'border-brand-200 border-t-brand-600';
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block animate-spin rounded-full border-2 ${palette} ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

/** Full-viewport centered loader on the aurora background (route-guard splash). */
export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="bg-aurora grid min-h-screen place-items-center">
      <div className="glass flex items-center gap-3 rounded-2xl px-6 py-4">
        <Spinner size={22} />
        <span className="text-sm font-medium text-ink-soft">{label}</span>
      </div>
    </div>
  );
}
