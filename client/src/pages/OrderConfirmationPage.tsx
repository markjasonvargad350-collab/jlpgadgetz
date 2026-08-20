import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Copy,
  Loader2,
  MapPin,
  PackageSearch,
  Receipt,
  Smartphone,
} from 'lucide-react';
import { formatPHP } from '../utils/format';
import { getOrder } from '../services/orders';
import { ApiError } from '../services/http';
import type { OrderDTO, OrderStatus, PaymentMethod, PaymentStatus } from '../types/order';

const WIDTH = 'mx-auto w-[min(100%-1.5rem,76rem)]';

const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  RECEIVED: 'Order received',
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

const PAYMENT_STATUS_BADGE: Record<PaymentStatus, { label: string; cls: string }> = {
  PENDING: { label: 'Pending', cls: 'bg-amber-100 text-amber-700' },
  PAID: { label: 'Paid', cls: 'bg-emerald-100 text-emerald-700' },
  FAILED: { label: 'Failed', cls: 'bg-red-100 text-red-700' },
  REFUNDED: { label: 'Refunded', cls: 'bg-stone-200 text-stone-600' },
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
}

export function OrderConfirmationPage() {
  const { orderNumber = '' } = useParams();
  const location = useLocation();
  const initial = (location.state as { order?: OrderDTO } | null)?.order ?? null;

  const [order, setOrder] = useState<OrderDTO | null>(initial);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Whether we arrived fresh from checkout (show celebratory hero) or via lookup.
  const cameFromCheckout = initial !== null;

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const found = await getOrder(orderNumber, email.trim());
      setOrder(found);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError("We couldn't find an order with that number and email. Please double-check both.");
      } else {
        setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  function copyOrderNumber(value: string) {
    navigator.clipboard?.writeText(value).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      },
      () => {
        /* clipboard unavailable — ignore */
      },
    );
  }

  // ── No order yet → email-verified lookup form ──
  if (!order) {
    return (
      <div className={`${WIDTH} py-16`}>
        <div className="glass mx-auto max-w-lg rounded-3xl p-8 sm:p-10">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl brand-gradient text-white">
            <PackageSearch size={26} />
          </span>
          <h1 className="mt-5 text-center font-display text-2xl font-extrabold">Look up your order</h1>
          <p className="mt-2 text-center text-sm text-ink-soft">
            Enter the email you used for order{' '}
            <span className="font-semibold text-ink">{orderNumber || '—'}</span> to view its details.
          </p>

          <form onSubmit={lookup} className="mt-6 flex flex-col gap-3" noValidate>
            <input
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="w-full rounded-2xl border border-white/70 bg-white/70 px-4 py-3 text-sm outline-none transition-shadow placeholder:text-ink-soft/70 focus:border-brand-300 focus:ring-2 focus:ring-brand-200"
            />
            {error && (
              <p className="flex items-center gap-2 text-sm text-coral">
                <AlertCircle size={15} /> {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading || !email.trim() || !orderNumber}
              className="flex items-center justify-center gap-2 rounded-full brand-gradient px-6 py-3 font-semibold text-white transition-transform hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Looking up…
                </>
              ) : (
                <>
                  View order <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <Link to="/shop" className="mt-5 block text-center text-sm font-semibold text-brand-700 hover:text-brand-800">
            Continue shopping
          </Link>
        </div>
      </div>
    );
  }

  // ── Order loaded → confirmation / details ──
  const payBadge = PAYMENT_STATUS_BADGE[order.paymentStatus];

  return (
    <div className={`${WIDTH} pt-10 pb-16`}>
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="glass rounded-3xl p-8 text-center sm:p-10"
      >
        <motion.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 14 }}
          className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
        >
          <CheckCircle2 size={32} />
        </motion.span>
        <h1 className="mt-5 font-display text-2xl font-extrabold sm:text-3xl">
          {cameFromCheckout ? `Thank you, ${order.customer.name.split(' ')[0]}!` : 'Order details'}
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          {cameFromCheckout
            ? 'Your order has been placed. Keep your order number to track your delivery.'
            : `Placed ${formatDateTime(order.placedAt)}.`}
        </p>

        <div className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2">
          <Receipt size={16} className="text-brand-600" />
          <span className="font-display font-bold tracking-wide">{order.orderNumber}</span>
          <button
            type="button"
            onClick={() => copyOrderNumber(order.orderNumber)}
            className="ml-1 grid h-7 w-7 place-items-center rounded-full text-ink-soft transition-colors hover:bg-white/80 hover:text-brand-700"
            aria-label="Copy order number"
          >
            {copied ? <CheckCircle2 size={15} className="text-emerald-600" /> : <Copy size={14} />}
          </button>
        </div>
        <p className="mt-3 text-xs text-ink-soft">
          Status: <span className="font-semibold text-ink">{ORDER_STATUS_LABEL[order.status]}</span>
        </p>
      </motion.div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]">
        {/* Items + totals */}
        <section className="glass rounded-3xl p-6">
          <h2 className="font-display text-lg font-bold">Items</h2>
          <ul className="mt-4 flex flex-col divide-y divide-white/60">
            {order.items.map((it) => (
              <li key={it.sku} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white/60">
                  {it.image ? (
                    <img src={it.image} alt={it.productName} className="h-full w-full object-cover" />
                  ) : (
                    <Smartphone size={24} className="text-brand-300" />
                  )}
                </div>
                <div className="flex-1">
                  {it.slug ? (
                    <Link to={`/product/${it.slug}`} className="font-semibold hover:text-brand-700">
                      {it.productName}
                    </Link>
                  ) : (
                    <span className="font-semibold">{it.productName}</span>
                  )}
                  <p className="text-sm text-ink-soft">{it.variantLabel}</p>
                  <p className="text-xs text-ink-soft">
                    {formatPHP(it.unitPrice)} × {it.quantity}
                  </p>
                </div>
                <p className="font-display font-bold">{formatPHP(it.lineTotal)}</p>
              </li>
            ))}
          </ul>

          <dl className="mt-5 space-y-2 border-t border-white/60 pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-soft">Subtotal</dt>
              <dd className="font-semibold">{formatPHP(order.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">Delivery</dt>
              <dd className={order.deliveryFee === 0 ? 'font-semibold text-brand-700' : 'font-semibold'}>
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
            <span className="font-display font-bold">Total</span>
            <span className="font-display text-xl font-extrabold text-gradient">{formatPHP(order.total)}</span>
          </div>
        </section>

        {/* Delivery + payment */}
        <aside className="flex flex-col gap-6">
          <section className="glass rounded-3xl p-6">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <MapPin size={18} className="text-brand-600" /> Deliver to
            </h2>
            <div className="mt-3 text-sm">
              <p className="font-semibold">{order.customer.name}</p>
              <p className="text-ink-soft">{order.customer.phone}</p>
              <p className="text-ink-soft">{order.customer.email}</p>
              <p className="mt-2">{order.address.addressLine}</p>
              <p>
                {order.address.barangay}, {order.address.city}
              </p>
              <p>
                {order.address.province} {order.address.postalCode}
              </p>
              {order.address.addressNote && (
                <p className="mt-2 rounded-xl bg-white/60 p-2 text-xs text-ink-soft">
                  Note: {order.address.addressNote}
                </p>
              )}
            </div>
          </section>

          <section className="glass rounded-3xl p-6">
            <h2 className="font-display text-lg font-bold">Payment</h2>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="font-semibold">{PAYMENT_METHOD_LABEL[order.paymentMethod]}</span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${payBadge.cls}`}>
                {payBadge.label}
              </span>
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
        </aside>
      </div>

      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link
          to="/shop"
          className="inline-flex items-center gap-2 rounded-full brand-gradient px-7 py-3 font-semibold text-white transition-transform hover:scale-[1.02]"
        >
          Continue shopping <ArrowRight size={16} />
        </Link>
        <Link to="/" className="rounded-full glass px-7 py-3 font-semibold text-ink transition-transform hover:scale-[1.02]">
          Back to home
        </Link>
      </div>
    </div>
  );
}
