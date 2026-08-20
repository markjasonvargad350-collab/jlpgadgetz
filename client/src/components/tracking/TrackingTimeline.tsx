import { Clock } from 'lucide-react';
import { formatDateTime } from '../../utils/format';
import { ORDER_STATUS_LABEL } from '../../config/delivery';
import type { OrderStatus, TrackingEntry } from '../../types/order';

interface Props {
  history: TrackingEntry[];
  /** Current order status — used for the empty-state fallback line. */
  currentStatus: OrderStatus;
  /** Tighter spacing + no card heading, for the confirmation page. */
  compact?: boolean;
}

/**
 * Append-only fulfillment timeline: a dot-rail with a connector line, the last
 * (most recent) step highlighted. Extracted from the admin order detail so the
 * customer track/confirmation views render an identical timeline.
 */
export function TrackingTimeline({ history, currentStatus, compact = false }: Props) {
  if (history.length === 0) {
    return (
      <p className={compact ? 'text-sm text-ink-soft' : 'mt-3 text-sm text-ink-soft'}>
        No status changes recorded yet. The order is currently{' '}
        <span className="font-semibold text-ink">{ORDER_STATUS_LABEL[currentStatus]}</span>.
      </p>
    );
  }

  return (
    <ol className={compact ? 'space-y-3' : 'mt-4 space-y-4'}>
      {history.map((h, i) => {
        const isLast = i === history.length - 1;
        return (
          <li key={`${h.status}-${h.createdAt}`} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                  isLast ? 'bg-brand-500 ring-4 ring-brand-500/20' : 'bg-ink-soft/40'
                }`}
              />
              {!isLast && <span className="mt-1 w-px flex-1 bg-white/70" />}
            </div>
            <div className="-mt-0.5 pb-1">
              <p className="text-sm font-semibold text-ink">{ORDER_STATUS_LABEL[h.status]}</p>
              {h.note && <p className="text-xs text-ink-soft">{h.note}</p>}
              <p className="text-xs text-ink-soft">{formatDateTime(h.createdAt)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Card-wrapped timeline with the "Fulfillment timeline" heading (admin/track). */
export function TrackingTimelineCard({ history, currentStatus }: Omit<Props, 'compact'>) {
  return (
    <section className="glass rounded-3xl p-6">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold">
        <Clock size={18} className="text-brand-600" /> Fulfillment timeline
      </h2>
      <TrackingTimeline history={history} currentStatus={currentStatus} />
    </section>
  );
}
