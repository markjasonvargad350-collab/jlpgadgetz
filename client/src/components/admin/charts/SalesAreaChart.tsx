import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDate, formatDateShort, formatPHP } from '../../../utils/format';
import type { ReportDayPoint } from '../../../types/admin';

/** Compact peso for the Y axis, e.g. 214110 → "₱214k", 1500000 → "₱1.5M". */
function compactPHP(value: number): string {
  if (value >= 1_000_000) return `₱${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  if (value >= 1_000) return `₱${Math.round(value / 1_000)}k`;
  return `₱${value}`;
}

interface TooltipPayload {
  payload: ReportDayPoint;
}

/** Glass tooltip: full peso revenue + order count for the hovered day. */
function ChartTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="glass rounded-2xl px-3.5 py-2.5 text-sm shadow-lg">
      <p className="font-semibold text-ink">{formatDate(point.date)}</p>
      <p className="mt-0.5 font-display font-bold text-gradient">{formatPHP(point.revenue)}</p>
      <p className="text-xs text-ink-soft">
        {point.orders} order{point.orders === 1 ? '' : 's'}
      </p>
    </div>
  );
}

/**
 * Reusable revenue area chart — the back-office charting idiom. Renders a
 * brand-gradient filled area over a daily series. `compact` drops the axes and
 * grid for the dashboard preview; the full version (Reports page) shows both.
 *
 * Colors reference the Sunset Glass `--color-brand-*` theme tokens so the chart
 * stays coherent when the exact brand hues are fine-tuned later.
 */
export function SalesAreaChart({
  data,
  height = 300,
  compact = false,
}: {
  data: ReportDayPoint[];
  height?: number;
  compact?: boolean;
}) {
  const total = data.reduce((sum, d) => sum + d.revenue, 0);
  const gradientId = compact ? 'salesFillCompact' : 'salesFill';

  return (
    <figure
      className="m-0"
      role="img"
      aria-label={`Revenue over the last ${data.length} days, totalling ${formatPHP(total)}.`}
    >
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={compact ? { top: 6, right: 6, bottom: 0, left: 0 } : { top: 8, right: 12, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-brand-500)" stopOpacity={0.38} />
              <stop offset="95%" stopColor="var(--color-brand-500)" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          {!compact && <CartesianGrid vertical={false} stroke="var(--color-ink)" strokeOpacity={0.06} />}

          <XAxis
            dataKey="date"
            hide={compact}
            tickFormatter={formatDateShort}
            tick={{ fill: 'var(--color-ink-soft)', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            minTickGap={28}
            dy={8}
          />
          <YAxis
            hide={compact}
            tickFormatter={compactPHP}
            tick={{ fill: 'var(--color-ink-soft)', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={52}
            allowDecimals={false}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--color-brand-400)', strokeWidth: 1, strokeDasharray: '4 4' }} />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="var(--color-brand-600)"
            strokeWidth={2.5}
            fill={`url(#${gradientId})`}
            activeDot={{ r: 4, fill: 'var(--color-brand-600)', stroke: '#fff', strokeWidth: 2 }}
            dot={false}
            isAnimationActive={!compact}
          />
        </AreaChart>
      </ResponsiveContainer>
    </figure>
  );
}
