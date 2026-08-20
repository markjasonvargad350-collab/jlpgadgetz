import { Suspense, lazy, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowRight, Loader2, MapPin, PackageSearch, RefreshCw, Truck } from 'lucide-react';
import { useOrderTracking } from '../hooks/useOrderTracking';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { TrackingTimelineCard } from '../components/tracking/TrackingTimeline';
import { OrderStatusBadge } from '../components/admin/ui/StatusBadge';
import { formatDate, formatDateTime } from '../utils/format';

const WIDTH = 'mx-auto w-[min(100%-1.5rem,76rem)]';

// Code-split: Leaflet + the map only load once an order is actually being tracked.
const TrackingMap = lazy(() => import('../components/tracking/TrackingMap'));

function MapSkeleton() {
  return (
    <div className="grid h-80 place-items-center rounded-3xl bg-white/50 ring-1 ring-white/60">
      <span className="flex items-center gap-2 text-sm text-ink-soft">
        <Loader2 size={16} className="animate-spin" /> Loading map…
      </span>
    </div>
  );
}

/**
 * The order-tracking hub. Guests look up an order by number + the email they
 * used at checkout (the server's ownership guard), then see the simulated
 * delivery map, the full fulfillment timeline, and shipment facts.
 */
export function TrackOrderPage() {
  const [params] = useSearchParams();
  const [orderNumber, setOrderNumber] = useState(params.get('order') ?? '');
  const [email, setEmail] = useState('');
  const [query, setQuery] = useState<{ orderNumber: string; email: string } | null>(null);

  const { data: order, loading, error, reload } = useOrderTracking(
    query?.orderNumber ?? null,
    query?.email ?? null,
  );

  useDocumentTitle(order ? `Track ${order.orderNumber}` : 'Track order');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const o = orderNumber.trim();
    const em = email.trim();
    if (!o || !em || loading) return;
    setQuery({ orderNumber: o, email: em });
  }

  // ── No order loaded → lookup form (also shown after a failed lookup) ──
  if (!order) {
    return (
      <div className={`${WIDTH} py-16`}>
        <div className="glass mx-auto max-w-lg rounded-3xl p-8 sm:p-10">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl brand-gradient text-white">
            <PackageSearch size={26} />
          </span>
          <h1 className="mt-5 text-center font-display text-2xl font-extrabold">Track your order</h1>
          <p className="mt-2 text-center text-sm text-ink-soft">
            Enter your order number and the email you used at checkout to follow its delivery.
          </p>

          <form onSubmit={submit} className="mt-6 flex flex-col gap-3" noValidate>
            <div>
              <label htmlFor="track-order-number" className="mb-1.5 block text-sm font-semibold text-ink">
                Order number
              </label>
              <div className="flex items-center gap-2 rounded-2xl border border-white/70 bg-white/70 px-4 py-3 focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-200">
                <MapPin size={18} className="shrink-0 text-ink-soft" />
                <input
                  id="track-order-number"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder="ORD-20260820-0001"
                  autoComplete="off"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-ink-soft/70"
                />
              </div>
            </div>
            <div>
              <label htmlFor="track-email" className="mb-1.5 block text-sm font-semibold text-ink">
                Email used at checkout
              </label>
              <input
                id="track-email"
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full rounded-2xl border border-white/70 bg-white/70 px-4 py-3 text-sm outline-none transition-shadow placeholder:text-ink-soft/70 focus:border-brand-300 focus:ring-2 focus:ring-brand-200"
              />
            </div>
            {error && (
              <p role="alert" className="flex items-center gap-2 text-sm text-coral">
                <AlertCircle size={15} /> {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading || !orderNumber.trim() || !email.trim()}
              className="flex items-center justify-center gap-2 rounded-full brand-gradient px-6 py-3 font-semibold text-white transition-transform hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Looking up…
                </>
              ) : (
                <>
                  Track order <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <Link to="/shop" className="mt-5 block text-center text-sm font-semibold text-brand-700 hover:text-brand-800">
            Browse products
          </Link>
        </div>
      </div>
    );
  }

  // ── Order loaded → tracking dashboard ──
  const s = order.shipment;
  return (
    <div className={`${WIDTH} pt-10 pb-16`}>
      <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-3xl p-5 sm:p-6">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-display text-xl font-extrabold tracking-wide">{order.orderNumber}</span>
            <OrderStatusBadge status={order.status} />
          </div>
          <p className="mt-1 text-xs text-ink-soft">Updated {formatDateTime(order.updatedAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={reload}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-full bg-white/70 px-4 py-2.5 text-sm font-semibold text-ink ring-1 ring-white/70 transition-colors hover:bg-white disabled:opacity-60"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button
            onClick={() => {
              setQuery(null);
              setEmail('');
            }}
            className="rounded-full bg-white/70 px-4 py-2.5 text-sm font-semibold text-ink-soft ring-1 ring-white/70 transition-colors hover:bg-white hover:text-ink"
          >
            Track another
          </button>
        </div>
      </div>

      {s ? (
        <div className="mt-6 flex flex-col gap-6">
          <Suspense fallback={<MapSkeleton />}>
            <TrackingMap shipment={s} />
          </Suspense>

          <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
            <TrackingTimelineCard history={s.history} currentStatus={order.status} />

            <aside className="flex flex-col gap-6">
              <section className="glass rounded-3xl p-6 text-sm">
                <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                  <Truck size={18} className="text-brand-600" /> Shipment
                </h2>
                <dl className="mt-3 space-y-2">
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-soft">Courier</dt>
                    <dd className="font-semibold text-ink">{s.courier ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-soft">Tracking</dt>
                    <dd className="font-mono text-ink">{s.trackingCode ?? '—'}</dd>
                  </div>
                  {s.deliveredAt ? (
                    <div className="flex justify-between gap-4">
                      <dt className="text-ink-soft">Delivered</dt>
                      <dd className="font-semibold text-emerald-600">{formatDateTime(s.deliveredAt)}</dd>
                    </div>
                  ) : s.estimatedArrival ? (
                    <div className="flex justify-between gap-4">
                      <dt className="text-ink-soft">Est. arrival</dt>
                      <dd className="font-semibold text-ink">{formatDate(s.estimatedArrival)}</dd>
                    </div>
                  ) : null}
                </dl>
              </section>

              <section className="glass rounded-3xl p-6 text-sm">
                <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                  <MapPin size={18} className="text-brand-600" /> Deliver to
                </h2>
                <div className="mt-3">
                  <p className="font-semibold text-ink">{order.customer.name}</p>
                  <p className="mt-2 text-ink">{order.address.addressLine}</p>
                  <p className="text-ink">
                    {order.address.barangay}, {order.address.city}
                  </p>
                  <p className="text-ink">
                    {order.address.province} {order.address.postalCode}
                  </p>
                </div>
              </section>
            </aside>
          </div>
        </div>
      ) : (
        <div className="glass mt-6 rounded-3xl p-8 text-center text-sm text-ink-soft">
          No shipment has been created for this order yet.
        </div>
      )}
    </div>
  );
}
