import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Boxes,
  Layers,
  PackageCheck,
  PackageX,
  Receipt,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { useInventoryStats } from '../../hooks/useInventoryStats';
import { useAdminOrders } from '../../hooks/useAdminOrders';
import { useReportsSummary } from '../../hooks/useReportsSummary';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { PageHeader } from '../../components/admin/ui/PageHeader';
import { StatTile } from '../../components/admin/ui/StatTile';
import { OrderStatusBadge } from '../../components/admin/ui/StatusBadge';
import { SalesAreaChart } from '../../components/admin/charts/SalesAreaChart';
import { formatPHP, formatDate } from '../../utils/format';

/** A titled panel with a muted note for sections landing in a later sub-phase. */
function SoonPanel({
  title,
  icon: Icon,
  note,
  children,
}: {
  title: string;
  icon: LucideIcon;
  note: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="glass rounded-3xl p-6">
      <div className="flex items-center gap-2">
        <Icon size={18} className="text-brand-600" />
        <h3 className="font-display font-bold">{title}</h3>
      </div>
      {children ?? (
        <div className="mt-6 grid place-items-center rounded-2xl bg-white/40 py-10 text-center">
          <p className="max-w-xs text-sm text-ink-soft">{note}</p>
        </div>
      )}
    </div>
  );
}

/** The five most recent orders, newest first, each linking to its detail. */
function RecentOrders() {
  const { data, loading, error } = useAdminOrders({ sort: 'placed_desc', pageSize: 5 });
  const orders = data?.items ?? [];

  if (loading) {
    return (
      <div className="mt-4 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-2xl bg-white/50" />
        ))}
      </div>
    );
  }
  if (error) {
    return <p role="alert" className="mt-6 text-center text-sm text-coral">{error}</p>;
  }
  if (orders.length === 0) {
    return (
      <div className="mt-6 grid place-items-center rounded-2xl bg-white/40 py-10 text-center">
        <p className="text-sm text-ink-soft">No orders yet.</p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <ul className="divide-y divide-white/50">
        {orders.map((o) => (
          <li key={o.orderNumber}>
            <Link
              to={`/admin/orders/${o.orderNumber}`}
              className="flex items-center gap-3 rounded-2xl px-2 py-2.5 transition-colors hover:bg-white/50"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">{o.customerName}</p>
                <p className="truncate text-xs text-ink-soft">
                  <span className="font-mono">{o.orderNumber}</span> · {formatDate(o.placedAt)}
                </p>
              </div>
              <OrderStatusBadge status={o.status} />
              <span className="w-24 text-right font-semibold text-ink">{formatPHP(o.total)}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link
        to="/admin/orders"
        className="mt-3 flex items-center justify-center gap-1 text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800"
      >
        View all orders <ArrowRight size={15} />
      </Link>
    </div>
  );
}

/** A compact 30-day revenue preview linking to the full Reports page. */
function SalesOverview() {
  const { data, loading, error } = useReportsSummary();

  if (loading) return <div className="mt-4 h-40 animate-pulse rounded-2xl bg-white/50" />;
  if (error) return <p role="alert" className="mt-6 text-center text-sm text-coral">{error}</p>;
  if (!data) return null;

  const { revenue, orders } = data.kpis.last30Days;
  const allZero = data.revenueByDay.every((d) => d.revenue === 0);

  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="font-display text-2xl font-extrabold text-ink">{formatPHP(revenue)}</p>
          <p className="text-xs text-ink-soft">
            {orders} order{orders === 1 ? '' : 's'} · last 30 days
          </p>
        </div>
        <Link
          to="/admin/reports"
          className="flex items-center gap-1 text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800"
        >
          View reports <ArrowRight size={15} />
        </Link>
      </div>
      {allZero ? (
        <div className="mt-4 grid place-items-center rounded-2xl bg-white/40 py-10 text-center">
          <p className="text-sm text-ink-soft">No revenue in the last 30 days yet.</p>
        </div>
      ) : (
        <div className="mt-2">
          <SalesAreaChart data={data.revenueByDay} height={140} compact />
        </div>
      )}
    </div>
  );
}

export function DashboardPage() {
  const { admin } = useAdminAuth();
  const { data: stats, loading, error } = useInventoryStats();
  const needsAttention = (stats?.low ?? 0) + (stats?.out ?? 0);
  useDocumentTitle('Dashboard');

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={admin ? `Welcome back, ${admin.name.split(' ')[0]}.` : undefined} />

      {error && (
        <div role="alert" className="mb-6 rounded-2xl bg-coral/10 px-4 py-3 text-sm text-coral ring-1 ring-coral/20">{error}</div>
      )}

      {/* stat tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile label="Variants" value={stats?.totalVariants ?? 0} icon={Boxes} hint={`${stats?.activeVariants ?? 0} active`} loading={loading} />
        <StatTile label="In stock" value={stats?.inStock ?? 0} icon={PackageCheck} loading={loading} />
        <StatTile label="Low stock" value={stats?.low ?? 0} icon={AlertTriangle} loading={loading} />
        <StatTile label="Out of stock" value={stats?.out ?? 0} icon={PackageX} loading={loading} />
        <StatTile label="Units on hand" value={stats?.totalUnits ?? 0} icon={Layers} loading={loading} />
        <StatTile label="Stock value" value={formatPHP(stats?.totalStockValue ?? 0)} icon={Wallet} loading={loading} />
      </div>

      {/* panels — filled in later sub-phases */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <SoonPanel title="Sales overview" icon={TrendingUp} note="">
          <SalesOverview />
        </SoonPanel>
        <SoonPanel title="Recent orders" icon={Receipt} note="">
          <RecentOrders />
        </SoonPanel>

        <SoonPanel title="Stock alerts" icon={AlertTriangle} note="">
          <div className="mt-6">
            {needsAttention > 0 ? (
              <Link
                to="/admin/inventory"
                className="flex items-center justify-between rounded-2xl bg-white/50 px-4 py-4 transition-colors hover:bg-white/70"
              >
                <div>
                  <p className="font-display text-2xl font-extrabold text-ink">{needsAttention}</p>
                  <p className="text-sm text-ink-soft">
                    {stats?.low ?? 0} low · {stats?.out ?? 0} out of stock
                  </p>
                </div>
                <span className="flex items-center gap-1 text-sm font-semibold text-brand-700">
                  Review <ArrowRight size={15} />
                </span>
              </Link>
            ) : (
              <div className="grid place-items-center rounded-2xl bg-white/40 py-10 text-center">
                <p className="text-sm text-ink-soft">All variants are healthily stocked. 🎉</p>
              </div>
            )}
          </div>
        </SoonPanel>

        <SoonPanel title="Activity" icon={Bell} note="An activity feed can be added with notifications (optional Phase 8e)." />
      </div>
    </div>
  );
}
