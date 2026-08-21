import { Suspense, lazy, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Ban, CreditCard, MapPin, Pencil, Save, Smartphone, Truck } from 'lucide-react';
import { useAdminOrder } from '../../hooks/useAdminOrder';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { updateOrderStatus } from '../../services/adminOrders';
import { updateShipment, type ShipmentUpdate } from '../../services/adminShipments';
import { ApiError } from '../../services/http';
import { PageHeader } from '../../components/admin/ui/PageHeader';
import { Spinner, PageLoader } from '../../components/admin/ui/Spinner';
import { OrderStatusBadge, PaymentStatusBadge } from '../../components/admin/ui/StatusBadge';
import { ConfirmDialog } from '../../components/admin/ui/ConfirmDialog';
import { TrackingTimelineCard } from '../../components/tracking/TrackingTimeline';
import { formatPHP, formatDate, formatDateTime, toDateInputValue } from '../../utils/format';
import type { OrderStatus, PaymentMethod, ShipmentDTO } from '../../types/order';

// Code-split: Leaflet + the map chunk load only when an order detail is opened.
const TrackingMap = lazy(() => import('../../components/tracking/TrackingMap'));

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

function MapFallback() {
  return (
    <div className="grid h-80 place-items-center rounded-3xl bg-white/50 ring-1 ring-white/60">
      <span className="flex items-center gap-2 text-sm text-ink-soft">
        <Spinner size={16} /> Loading map…
      </span>
    </div>
  );
}

/**
 * Shipment facts plus an ADMIN-only inline editor for the human-managed fields
 * (courier / tracking code / ETA). Shipment **status** and **coordinates** are
 * owned by the fulfillment state-machine (advancing the order moves them) and
 * are deliberately not editable here. Saving PATCHes the shipment then reloads
 * the order so the facts + map reflect the change.
 */
function ShipmentCard({
  shipment,
  orderNumber,
  isAdmin,
  onSaved,
}: {
  shipment: ShipmentDTO;
  orderNumber: string;
  isAdmin: boolean;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [courier, setCourier] = useState('');
  const [trackingCode, setTrackingCode] = useState('');
  const [eta, setEta] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function startEdit() {
    setCourier(shipment.courier ?? '');
    setTrackingCode(shipment.trackingCode ?? '');
    setEta(shipment.estimatedArrival ? toDateInputValue(shipment.estimatedArrival) : '');
    setErr(null);
    setEditing(true);
  }

  // Only send non-empty fields (the schema forbids blanks and requires ≥1).
  const patch: ShipmentUpdate = {};
  if (courier.trim()) patch.courier = courier.trim();
  if (trackingCode.trim()) patch.trackingCode = trackingCode.trim();
  if (eta) patch.estimatedArrival = eta;
  const nothingToSave = Object.keys(patch).length === 0;

  async function save() {
    if (nothingToSave || saving) return;
    setSaving(true);
    setErr(null);
    try {
      await updateShipment(orderNumber, patch);
      setEditing(false);
      onSaved();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not update the shipment.');
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    'w-full rounded-xl border border-white/70 bg-white/70 px-3 py-2 text-sm text-ink outline-none transition-shadow placeholder:text-ink-soft/70 focus:border-brand-300 focus:ring-2 focus:ring-brand-200';

  return (
    <section className="glass rounded-3xl p-6 text-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <Truck size={18} className="text-brand-600" /> Shipment
        </h2>
        {isAdmin && !editing && (
          <button
            onClick={startEdit}
            className="flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 text-xs font-semibold text-ink-soft ring-1 ring-white/70 transition-colors hover:bg-white hover:text-ink"
          >
            <Pencil size={13} /> Edit
          </button>
        )}
      </div>

      {!editing ? (
        <dl className="mt-3 space-y-2">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-soft">Courier</dt>
            <dd className="font-semibold text-ink">{shipment.courier ?? '—'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-soft">Tracking</dt>
            <dd className="font-mono text-ink">{shipment.trackingCode ?? '—'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-soft">Est. arrival</dt>
            <dd className="font-semibold text-ink">
              {shipment.estimatedArrival ? formatDate(shipment.estimatedArrival) : '—'}
            </dd>
          </div>
          {shipment.deliveredAt && (
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">Delivered</dt>
              <dd className="font-semibold text-emerald-600">{formatDateTime(shipment.deliveredAt)}</dd>
            </div>
          )}
        </dl>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-ink-soft">Courier</span>
            <input
              value={courier}
              onChange={(e) => setCourier(e.target.value)}
              maxLength={80}
              placeholder="JLP Express"
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-ink-soft">Tracking code</span>
            <input
              value={trackingCode}
              onChange={(e) => setTrackingCode(e.target.value)}
              maxLength={80}
              placeholder="IEX…"
              className={`${inputCls} font-mono`}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-ink-soft">Est. arrival</span>
            <input type="date" value={eta} onChange={(e) => setEta(e.target.value)} className={inputCls} />
          </label>

          {err && <p role="alert" className="text-xs text-coral">{err}</p>}

          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={nothingToSave || saving}
              className="flex items-center gap-1.5 rounded-full brand-gradient px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
            >
              {saving ? <Spinner size={14} tone="light" /> : <Save size={14} />} Save
            </button>
            <button
              onClick={() => setEditing(false)}
              disabled={saving}
              className="rounded-full bg-white/70 px-4 py-2 text-sm font-semibold text-ink-soft ring-1 ring-white/70 transition-colors hover:bg-white hover:text-ink disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export function OrderDetailPage() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const { isAdmin } = useAdminAuth();
  const { data: order, loading, error, reload } = useAdminOrder(orderNumber ?? null);

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useDocumentTitle(order ? `Order ${order.orderNumber}` : 'Order');

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
        <div role="alert" className="mb-6 rounded-2xl bg-coral/10 px-4 py-3 text-sm text-coral ring-1 ring-coral/20">{actionError}</div>
      )}

      {order.shipment && (
        <div className="mb-6">
          <Suspense fallback={<MapFallback />}>
            <TrackingMap shipment={order.shipment} />
          </Suspense>
        </div>
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

          {/* Fulfillment timeline (shared with the customer track view) */}
          <TrackingTimelineCard history={history} currentStatus={order.status} />
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

          {order.shipment && (
            <ShipmentCard
              shipment={order.shipment}
              orderNumber={order.orderNumber}
              isAdmin={isAdmin}
              onSaved={reload}
            />
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
