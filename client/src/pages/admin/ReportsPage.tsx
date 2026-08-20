import {
  CalendarClock,
  CalendarDays,
  CalendarRange,
  Package,
  Receipt,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useReportsSummary } from '../../hooks/useReportsSummary';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { PageHeader } from '../../components/admin/ui/PageHeader';
import { PageLoader } from '../../components/admin/ui/Spinner';
import { StatTile } from '../../components/admin/ui/StatTile';
import { OrderStatusBadge } from '../../components/admin/ui/StatusBadge';
import { SalesAreaChart } from '../../components/admin/charts/SalesAreaChart';
import { formatPHP } from '../../utils/format';
import type { PaymentMethod } from '../../types/order';

const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  COD: 'Cash on delivery',
  GCASH: 'GCash',
  BANK_TRANSFER: 'Bank transfer',
};

export function ReportsPage() {
  const { data, loading, error } = useReportsSummary();
  useDocumentTitle('Reports');

  if (loading && !data) return <PageLoader label="Loading reports…" />;
  if (error || !data) {
    return (
      <div>
        <PageHeader title="Reports" subtitle="Sales performance and order insights." />
        <div className="glass rounded-3xl p-8 text-center">
          <p className="font-display text-lg font-bold text-ink">Couldn’t load reports</p>
          <p className="mt-1 text-sm text-ink-soft">{error ?? 'Please try again.'}</p>
        </div>
      </div>
    );
  }

  const { kpis, paidRevenueAllTime, averageOrderValue, statusBreakdown, paymentMix, revenueByDay, topProducts } = data;
  const maxStatus = Math.max(1, ...statusBreakdown.map((s) => s.count));
  const maxPayment = Math.max(1, ...paymentMix.map((p) => p.total));
  const maxTop = Math.max(1, ...topProducts.map((p) => p.quantity));

  return (
    <div>
      <PageHeader title="Reports" subtitle="Sales performance and order insights, in Philippine time." />

      {/* KPI tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Today" value={formatPHP(kpis.today.revenue)} icon={CalendarClock} hint={`${kpis.today.orders} order${kpis.today.orders === 1 ? '' : 's'}`} />
        <StatTile label="Last 7 days" value={formatPHP(kpis.last7Days.revenue)} icon={CalendarDays} hint={`${kpis.last7Days.orders} order${kpis.last7Days.orders === 1 ? '' : 's'}`} />
        <StatTile label="Last 30 days" value={formatPHP(kpis.last30Days.revenue)} icon={CalendarRange} hint={`${kpis.last30Days.orders} order${kpis.last30Days.orders === 1 ? '' : 's'}`} />
        <StatTile label="All-time" value={formatPHP(kpis.allTime.revenue)} icon={TrendingUp} hint={`${kpis.allTime.orders} order${kpis.allTime.orders === 1 ? '' : 's'}`} />
        <StatTile label="Avg. order" value={formatPHP(averageOrderValue)} icon={Receipt} />
        <StatTile label="Collected" value={formatPHP(paidRevenueAllTime)} icon={Wallet} hint="Payments settled" />
      </div>

      {/* Sales chart */}
      <section className="glass mt-6 rounded-3xl p-6">
        <div className="mb-2 flex items-center gap-2">
          <TrendingUp size={18} className="text-brand-600" />
          <h2 className="font-display text-lg font-bold">Revenue — last 30 days</h2>
        </div>
        <p className="mb-4 text-xs text-ink-soft">Excludes cancelled orders. Cash-on-delivery counts as booked revenue when placed.</p>
        <SalesAreaChart data={revenueByDay} height={300} />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Order status breakdown */}
        <section className="glass rounded-3xl p-6">
          <h2 className="font-display text-lg font-bold">Orders by status</h2>
          <ul className="mt-4 space-y-3">
            {statusBreakdown.map((s) => (
              <li key={s.status} className="flex items-center gap-3">
                <span className="w-36 shrink-0">
                  <OrderStatusBadge status={s.status} />
                </span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/50" aria-hidden>
                  <span className="block h-full rounded-full brand-gradient" style={{ width: `${(s.count / maxStatus) * 100}%` }} />
                </span>
                <span className="w-8 text-right font-semibold text-ink">{s.count}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Payment mix */}
        <section className="glass rounded-3xl p-6">
          <h2 className="font-display text-lg font-bold">Payment mix</h2>
          <p className="mt-0.5 text-xs text-ink-soft">Non-cancelled orders, by method.</p>
          <ul className="mt-4 space-y-4">
            {paymentMix.map((p) => (
              <li key={p.method}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-semibold text-ink">{PAYMENT_METHOD_LABEL[p.method]}</span>
                  <span className="text-ink-soft">
                    {p.count} order{p.count === 1 ? '' : 's'} · <span className="font-semibold text-ink">{formatPHP(p.total)}</span>
                  </span>
                </div>
                <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-white/50" aria-hidden>
                  <span className="block h-full rounded-full brand-gradient" style={{ width: `${(p.total / maxPayment) * 100}%` }} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Top products */}
      <section className="glass mt-6 rounded-3xl p-6">
        <div className="mb-4 flex items-center gap-2">
          <Package size={18} className="text-brand-600" />
          <h2 className="font-display text-lg font-bold">Top products</h2>
          <span className="text-xs text-ink-soft">by units sold</span>
        </div>
        {topProducts.length === 0 ? (
          <div className="grid place-items-center rounded-2xl bg-white/40 py-10 text-center">
            <p className="text-sm text-ink-soft">No sales yet.</p>
          </div>
        ) : (
          <ol className="space-y-3">
            {topProducts.map((p, i) => (
              <li key={p.productName} className="flex items-center gap-4">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/60 font-display text-sm font-bold text-brand-700 ring-1 ring-white/70">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{p.productName}</p>
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-white/50" aria-hidden>
                    <span className="block h-full rounded-full brand-gradient" style={{ width: `${(p.quantity / maxTop) * 100}%` }} />
                  </span>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold text-ink">
                    {p.quantity} unit{p.quantity === 1 ? '' : 's'}
                  </p>
                  <p className="text-xs text-ink-soft">{formatPHP(p.revenue)}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
