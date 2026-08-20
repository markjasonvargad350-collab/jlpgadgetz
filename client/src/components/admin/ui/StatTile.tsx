import type { LucideIcon } from 'lucide-react';

/**
 * Dashboard/inventory summary tile: a brand-gradient icon chip, a large value,
 * a label, and an optional hint line. Renders a shimmer while `loading`.
 */
export function StatTile({
  label,
  value,
  icon: Icon,
  hint,
  loading = false,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  loading?: boolean;
}) {
  return (
    <div className="glass flex items-center gap-4 rounded-3xl p-5">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl brand-gradient text-white">
        <Icon size={20} />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium tracking-wide text-ink-soft uppercase">{label}</p>
        {loading ? (
          <span className="mt-1 block h-7 w-20 animate-pulse rounded-lg bg-white/70" />
        ) : (
          <p className="font-display text-2xl font-extrabold text-ink">{value}</p>
        )}
        {hint && !loading && <p className="mt-0.5 truncate text-xs text-ink-soft">{hint}</p>}
      </div>
    </div>
  );
}
