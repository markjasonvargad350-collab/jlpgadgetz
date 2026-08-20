import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Ban, Clock, CreditCard, MapPin, Smartphone } from 'lucide-react';
import { useAdminOrder } from '../../hooks/useAdminOrder';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { updateOrderStatus } from '../../services/adminOrders';
import { ApiError } from '../../services/http';
import { PageHeader } from '../../components/admin/ui/PageHeader';
import { Spinner, PageLoader } from '../../components/admin/ui/Spinner';
import { OrderStatusBadge, PaymentStatusBadge } from '../../components/admin/ui/StatusBadge';
import { ConfirmDialog } from '../../components/admin/ui/ConfirmDialog';
import { formatPHP, formatDate, formatDateTime } from '../../utils/format';
import type { OrderStatus, PaymentMethod } from '../../types/order';

// Client mirror of the server's ALLOWED_TRANSITIONS forward step. The single
// legal next state per status; absent = terminal (DELIVERED / CANCELLED). The
// server re-validates — this only decides which button to offer.
const NEXT_FORWARD: Partial<Record<OrderStatus, OrderStatus>> = {
  RECEIVED: 'PROCESSING',
  PROCESSING: 'PACKED',
  PACKED: 'SHIPPED',
  SHIPPED: 'IN_TRANSIT',
  IN_TRANSIT: 'OUT_FOR_DELIVERY',
  OUT_FOR_DELIVERY: 'DELIVERED',
};

const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  RECEIVED: 'Received',
  PROCESSING: 'Processing',
  PACKED: 'Packed',
  SHIPPED: 'Shipped',
  IN_TRANSIT: 'In transit',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  COD: 'Cash on Delivery',
  GCASH: 'GCash',
  BANK_TRANSFER: 'Bank Transfer',
};

function BackLink() {
  return (
    <Link
      to="/admin/orders"
      className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft transition-colors hover:text-ink"
    >
      <ArrowLeft size={16} /> Back to orders
    </Link>
  );
}

export function OrderDetailPage() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const { isAdmin } = useAdminAuth();
  const { data: order, loading, error, reload } = useAdminOrder(orderNumber ?? null);

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (loading && !order) return <PageLoader label="Loading order…" />;
  if (error || !order) {
    return (
      <div>
        <BackLink />
        <div className="glass rounded-3xl p-8 text-center">
          <p className="font-display text-lg font-bold text-ink">Couldn’t load this order</p>
          <p className="mt-1 text-sm text-ink-soft">{error ?? 'It may not exist.'}</p>
        </div>
      </div>
    );
  }

  const next = NEXT_FORWARD[order.status];
  const isTerminal = !next; // DELIVERED / CANCELLED have no forward step
  const canCancel = isAdmin && order.status !== 'DELIVERED' && order.status !== 'CANCELLED';
  const history = order.shipment?.history ?? [];

  async function changeStatus(target: OrderStatus) {
    setActionError(null);
    setBusy(true);
    try {
      await updateOrderStatus(order!.orderNumber, target);
      setConfirmOpen(false);
      reload();
    } catch (err) {
      setConfirmOpen(false);
      // A 409 means someone else moved it — the reload will show the true state.
      if (err instanceof ApiError && err.status === 409) reload();
      setActionError(err instanceof ApiError ? err.message : 'Could not update the order.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <BackLink />
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono">{order.orderNumber}</span>
            <OrderStatusBadge status={order.status} />
          </span>
        }
        subtitle={
          <span className="text-ink-soft">
            Placed {formatDateTime(order.placedAt)} · Updated {formatDateTime(order.updatedAt)}
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            {canCancel && (
              <button
                onClick={() => {
                  setActionError(null);
                  setConfirmOpen(true);
                }}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-full bg-white/70 px-4 py-2.5 text-sm font-semibold text-coral ring-1 ring-coral/20 transition-colors hover:bg-white disabled:opacity-60"
              >
                <Ban size={15} /> Cancel order
              </button>
            )}
            {next && (
              <button
                onClick={() => changeStatus(next)}
                disabled={busy}
                className="flex items-center gap-2 rounded-full brand-gradient px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-70 disabled:hover:scale-100"
              >
                {busy ? <Spinner size={15} tone="light" /> : <ArrowRight size={16} />}
                Mark as {ORDER_STATUS_LABEL[next]}
              </button>
            )}
            {isTerminal && (
              <span className="rounded-full bg-white/60 px-4 py-2.5 text-sm font-semibold text-ink-soft ring-1 ring-white/70">
                {order.status === 'DELIVERED' ? 'Fulfillment complete' : 'Order cancelled'}
              </span>
            )}
          </div>
        }
      />

      {actionError && (
        <div className="mb-6 rounded-2xl bg-coral/10 px-4 py-3 text-sm text-coral ring-1 ring-coral/20">{actionError}</div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        {/* Items + totals + timeline */}
        <div className="flex flex-col gap-6">
          <section className="glass rounded-3xl p-6">
            <h2 className="font-display text-lg font-bold">Items</h2>
            <ul className="mt-4 flex flex-col divide-y divide-white/60">
              {order.items.map((it) => (
                <li key={it.sku} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white/60 ring-1 ring-white/70">
                    {it.image ? (
                      <img src={it.image} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <Smartphone size={22} className="text-brand-300" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    {it.slug ? (
                      <Link to={`/product/${it.slug}`} className="font-semibold text-ink hover:text-brand-700">
                        {it.productName}
                      </Link>
                    ) : (
                      <span className="font-semibold text-ink">{it.productName}</span>
                    )}
                    <p className="text-sm text-ink-soft">{it.variantLabel}</p>
                    <p className="text-xs text-ink-soft">
                      <span className="font-mono">{it.sku}</span> · {formatPHP(it.unitPrice)} × {it.quantity}
                    </p>
                  </div>
                  <p className="font-display font-bold text-ink">{formatPHP(it.lineTotal)}</p>
                </li>
              ))}
            </ul>

            <dl className="mt-5 space-y-2 border-t border-white/60 pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-soft">Subtotal</dt>
                <dd className="font-semibold text-ink">{formatPHP(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-soft">Delivery</dt>
                <dd className={order.deliveryFee === 0 ? 'font-semibold text-brand-700' : 'font-semibold text-ink'}>
                  {order.deliveryFee === 0 ? 'FREE' : formatPHP(order.deliveryFee)}
                </dd>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-ink-soft">Discount</dt>
                  <dd className="font-semibold text-emerald-600">−{formatPHP(order.discount)}</dd>
                </div>
              )}
            </dl>
            <div className="mt-4 flex items-center justify-between border-t border-white/60 pt-4">
              <span className="font-display font-bold text-ink">Total</span>
              <span className="font-display text-xl font-extrabold text-gradient">{formatPHP(order.total)}</span>
            </div>
          </section>

          {/* Fulfillment timeline */}
          <section className="glass rounded-3xl p-6">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <Clock size={18} className="text-brand-600" /> Fulfillment timeline
            </h2>
            {history.length === 0 ? (
              <p className="mt-3 text-sm text-ink-soft">
                No status changes recorded yet. The order is currently{' '}
                <span className="font-semibold text-ink">{ORDER_STATUS_LABEL[order.status]}</span>.
              </p>
            ) : (
              <ol className="mt-4 space-y-4">
                {history.map((h, i) => {
                  const isLast = i === history.length - 1;
                  return (
                    <li key={`${h.status}-${h.createdAt}`} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span
                          className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${isLast ? 'bg-brand-500 ring-4 ring-brand-500/20' : 'bg-ink-soft/40'}`}
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
            )}
          </section>
        </div>

        {/* Customer + payment */}
        <aside className="flex flex-col gap-6">
          <section className="glass rounded-3xl p-6">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <MapPin size={18} className="text-brand-600" /> Deliver to
            </h2>
            <div className="mt-3 text-sm">
              <p className="font-semibold text-ink">{order.customer.name}</p>
              <p className="text-ink-soft">{order.customer.phone}</p>
              <p className="break-all text-ink-soft">{order.customer.email}</p>
              <p className="mt-2 text-ink">{order.address.addressLine}</p>
              <p className="text-ink">
                {order.address.barangay}, {order.address.city}
              </p>
              <p className="text-ink">
                {order.address.province} {order.address.postalCode}
              </p>
              {order.address.addressNote && (
                <p className="mt-2 rounded-xl bg-white/60 p-2 text-xs text-ink-soft">Note: {order.address.addressNote}</p>
              )}
            </div>
          </section>

          <section className="glass rounded-3xl p-6">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <CreditCard size={18} className="text-brand-600" /> Payment
            </h2>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="font-semibold text-ink">{PAYMENT_METHOD_LABEL[order.paymentMethod]}</span>
              <PaymentStatusBadge status={order.paymentStatus} />
            </div>
            {order.payment.reference && (
              <p className="mt-2 text-xs text-ink-soft">
                Reference: <span className="font-mono text-ink">{order.payment.reference}</span>
              </p>
            )}
            <p className="mt-3 rounded-xl bg-white/60 p-3 text-xs leading-relaxed text-ink-soft">
              {order.payment.instructions}
            </p>
          </section>

          {order.shipment && (order.shipment.courier || order.shipment.trackingCode) && (
            <section className="glass rounded-3xl p-6 text-sm">
              <h2 className="font-display text-lg font-bold">Shipment</h2>
              {order.shipment.courier && (
                <p className="mt-2 text-ink-soft">
                  Courier: <span className="font-semibold text-ink">{order.shipment.courier}</span>
                </p>
              )}
              {order.shipment.trackingCode && (
                <p className="mt-1 text-ink-soft">
                  Tracking: <span className="font-mono text-ink">{order.shipment.trackingCode}</span>
                </p>
              )}
              {order.shipment.estimatedArrival && (
                <p className="mt-1 text-ink-soft">Est. arrival: {formatDate(order.shipment.estimatedArrival)}</p>
              )}
            </section>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Cancel this order?"
        message={
          <>
            Cancelling <span className="font-semibold text-ink">{order.orderNumber}</span> will restock every item and
            refund any captured payment. This can’t be undone.
          </>
        }
        confirmLabel="Cancel order"
        cancelLabel="Keep order"
        tone="danger"
        loading={busy}
        onConfirm={() => changeStatus('CANCELLED')}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}
