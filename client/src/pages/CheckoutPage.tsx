import { useMemo, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  Building2,
  Loader2,
  Lock,
  ShoppingBag,
  Smartphone,
  Wallet,
} from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { formatPHP } from '../utils/format';
import { estimateDeliveryFee, FREE_DELIVERY_THRESHOLD } from '../config/order';
import { createOrder } from '../services/orders';
import { ApiError } from '../services/http';
import type { CreateOrderRequest, PaymentMethod, StockConflictDetails } from '../types/order';

const WIDTH = 'mx-auto w-[min(100%-1.5rem,76rem)]';

// ── Form state (flat for simple binding; nested on submit) ───────────────────

interface FormState {
  name: string;
  email: string;
  phone: string;
  addressLine: string;
  barangay: string;
  city: string;
  province: string;
  postalCode: string;
  addressNote: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  email: '',
  phone: '',
  addressLine: '',
  barangay: '',
  city: '',
  province: '',
  postalCode: '',
  addressNote: '',
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

// Client-side validation mirrors the server's Zod rules for fast UX feedback;
// the server remains the source of truth and re-validates everything.
function validate(form: FormState): FieldErrors {
  const e: FieldErrors = {};
  const name = form.name.trim();
  if (name.length < 2) e.name = 'Please enter your full name.';
  else if (name.length > 80) e.name = 'Name is too long.';

  const email = form.email.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) e.email = 'Enter a valid email address.';

  const phone = form.phone.replace(/[\s-]/g, '');
  if (!/^(?:\+63|0)9\d{9}$/.test(phone)) e.phone = 'Enter a valid PH mobile (e.g. 0917 123 4567).';

  const addressLine = form.addressLine.trim();
  if (addressLine.length < 3) e.addressLine = 'House no. and street are required.';
  else if (addressLine.length > 160) e.addressLine = 'Address is too long.';

  if (form.barangay.trim().length < 1) e.barangay = 'Barangay is required.';
  if (form.city.trim().length < 1) e.city = 'City / municipality is required.';
  if (form.province.trim().length < 1) e.province = 'Province is required.';
  if (!/^\d{4}$/.test(form.postalCode.trim())) e.postalCode = 'PH postal code is 4 digits.';
  if (form.addressNote.trim().length > 200) e.addressNote = 'Note is too long (max 200).';
  return e;
}

// ── Payment options ──────────────────────────────────────────────────────────

const PAYMENT_OPTIONS: {
  value: PaymentMethod;
  label: string;
  hint: string;
  icon: ReactNode;
}[] = [
  {
    value: 'COD',
    label: 'Cash on Delivery',
    hint: 'Pay in cash when your order arrives.',
    icon: <Banknote size={18} />,
  },
  {
    value: 'GCASH',
    label: 'GCash',
    hint: 'Simulated e-wallet payment (demo) — instructions shown after ordering.',
    icon: <Wallet size={18} />,
  },
  {
    value: 'BANK_TRANSFER',
    label: 'Bank Transfer',
    hint: 'Simulated bank transfer (demo) — instructions shown after ordering.',
    icon: <Building2 size={18} />,
  },
];

// ── Reusable field ─────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  name: keyof FormState;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
  inputMode?: 'text' | 'email' | 'tel' | 'numeric';
  optional?: boolean;
  className?: string;
}

function Field({
  label,
  name,
  value,
  onChange,
  error,
  placeholder,
  type = 'text',
  autoComplete,
  inputMode,
  optional,
  className = '',
}: FieldProps) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 flex items-center gap-1 text-sm font-semibold text-ink">
        {label}
        {optional && <span className="text-xs font-normal text-ink-soft">(optional)</span>}
      </span>
      <input
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        type={type}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
        className={`w-full rounded-2xl border bg-white/70 px-4 py-3 text-sm outline-none transition-shadow placeholder:text-ink-soft/70 focus:ring-2 ${
          error
            ? 'border-coral/60 focus:ring-coral/30'
            : 'border-white/70 focus:border-brand-300 focus:ring-brand-200'
        }`}
      />
      {error && (
        <span id={`${name}-error`} role="alert" className="mt-1 block text-xs font-medium text-coral">
          {error}
        </span>
      )}
    </label>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function CheckoutPage() {
  const { items, subtotal, count, setQuantity, removeItem, clear } = useCart();
  const navigate = useNavigate();
  useDocumentTitle('Checkout');

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('COD');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [stockConflict, setStockConflict] = useState<StockConflictDetails | null>(null);

  const deliveryFee = useMemo(() => estimateDeliveryFee(subtotal), [subtotal]);
  const total = subtotal + deliveryFee;

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    // Clear the inline error for a field as soon as the user edits it.
    setErrors((prev) => (prev[name as keyof FormState] ? { ...prev, [name]: undefined } : prev));
  }

  function resolveConflict() {
    if (!stockConflict) return;
    if (stockConflict.available <= 0) removeItem(stockConflict.variantId);
    else setQuantity(stockConflict.variantId, stockConflict.available);
    setStockConflict(null);
    setFormError(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setFormError(null);
    setStockConflict(null);

    const found = validate(form);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      setFormError('Please fix the highlighted fields.');
      return;
    }
    setErrors({});

    const req: CreateOrderRequest = {
      customer: { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() },
      address: {
        addressLine: form.addressLine.trim(),
        barangay: form.barangay.trim(),
        city: form.city.trim(),
        province: form.province.trim(),
        postalCode: form.postalCode.trim(),
        ...(form.addressNote.trim() ? { addressNote: form.addressNote.trim() } : {}),
      },
      paymentMethod,
      // Only variant + quantity leave the browser — never prices or names.
      items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
    };

    setSubmitting(true);
    try {
      const order = await createOrder(req);
      clear();
      navigate(`/order/${order.orderNumber}`, { state: { order } });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409 && err.details && typeof err.details === 'object') {
          setStockConflict(err.details as StockConflictDetails);
          setFormError(err.message);
        } else if (err.status === 422) {
          setFormError('Some details need fixing — please review and try again.');
        } else {
          setFormError(err.message);
        }
      } else {
        setFormError('Something went wrong placing your order. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Empty cart → nudge back to the shop (also the state after a successful order,
  // though we navigate away before this renders).
  if (items.length === 0) {
    return (
      <div className={`${WIDTH} py-24 text-center`}>
        <div className="glass mx-auto max-w-md rounded-3xl p-10">
          <ShoppingBag className="mx-auto text-brand-300" size={48} />
          <h1 className="mt-4 font-display text-2xl font-bold">Your cart is empty</h1>
          <p className="mt-2 text-sm text-ink-soft">Add an item before heading to checkout.</p>
          <Link
            to="/shop"
            className="mt-6 inline-flex items-center gap-2 rounded-full brand-gradient px-6 py-3 font-semibold text-white"
          >
            Browse products <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  const amountToFreeDelivery = FREE_DELIVERY_THRESHOLD - subtotal;

  return (
    <div className={`${WIDTH} pt-10 pb-16`}>
      <h1 className="font-display text-3xl font-extrabold sm:text-4xl">Checkout</h1>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-soft">
        <Lock size={13} /> Guest checkout — no account needed. Your details are used only to fulfil this order.
      </p>

      <form onSubmit={onSubmit} className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]" noValidate>
        {/* ── Left: details ── */}
        <div className="flex flex-col gap-6">
          {formError && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3 rounded-2xl border border-coral/40 bg-coral/10 p-4 text-sm text-coral"
              role="alert"
            >
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">{formError}</p>
                {stockConflict && (
                  <button
                    type="button"
                    onClick={resolveConflict}
                    className="mt-2 rounded-full bg-coral px-4 py-1.5 text-xs font-semibold text-white transition-transform hover:scale-[1.03]"
                  >
                    {stockConflict.available <= 0
                      ? `Remove ${stockConflict.productName} from cart`
                      : `Set ${stockConflict.productName} to ${stockConflict.available} and continue`}
                  </button>
                )}
              </div>
            </motion.div>
          )}

          <section className="glass rounded-3xl p-6">
            <h2 className="font-display text-lg font-bold">Contact details</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Full name" name="name" value={form.name} onChange={onChange} error={errors.name} placeholder="Juan Dela Cruz" autoComplete="name" className="sm:col-span-2" />
              <Field label="Email" name="email" value={form.email} onChange={onChange} error={errors.email} placeholder="you@example.com" type="email" inputMode="email" autoComplete="email" />
              <Field label="Mobile number" name="phone" value={form.phone} onChange={onChange} error={errors.phone} placeholder="0917 123 4567" type="tel" inputMode="tel" autoComplete="tel" />
            </div>
            <p className="mt-3 text-xs text-ink-soft">
              You’ll use this email to look up your order status later — no account needed.
            </p>
          </section>

          <section className="glass rounded-3xl p-6">
            <h2 className="font-display text-lg font-bold">Delivery address</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="House no. & street" name="addressLine" value={form.addressLine} onChange={onChange} error={errors.addressLine} placeholder="123 Mabini St." autoComplete="address-line1" className="sm:col-span-2" />
              <Field label="Barangay" name="barangay" value={form.barangay} onChange={onChange} error={errors.barangay} placeholder="Barangay San Antonio" />
              <Field label="City / municipality" name="city" value={form.city} onChange={onChange} error={errors.city} placeholder="Makati City" autoComplete="address-level2" />
              <Field label="Province" name="province" value={form.province} onChange={onChange} error={errors.province} placeholder="Metro Manila" autoComplete="address-level1" />
              <Field label="Postal code" name="postalCode" value={form.postalCode} onChange={onChange} error={errors.postalCode} placeholder="1200" inputMode="numeric" autoComplete="postal-code" />
              <Field label="Delivery note" name="addressNote" value={form.addressNote} onChange={onChange} error={errors.addressNote} placeholder="Landmark, gate code, etc." optional className="sm:col-span-2" />
            </div>
          </section>

          <section className="glass rounded-3xl p-6">
            <h2 className="font-display text-lg font-bold">Payment method</h2>
            <div className="mt-4 flex flex-col gap-3">
              {PAYMENT_OPTIONS.map((opt) => {
                const active = paymentMethod === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors ${
                      active ? 'border-brand-400 bg-white/70' : 'border-white/60 bg-white/40 hover:bg-white/60'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={opt.value}
                      checked={active}
                      onChange={() => setPaymentMethod(opt.value)}
                      className="sr-only"
                    />
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                        active ? 'brand-gradient text-white' : 'bg-white/70 text-ink-soft'
                      }`}
                    >
                      {opt.icon}
                    </span>
                    <span className="flex-1">
                      <span className="flex items-center justify-between">
                        <span className="font-semibold text-ink">{opt.label}</span>
                        <span
                          className={`grid h-5 w-5 place-items-center rounded-full border ${
                            active ? 'border-brand-500' : 'border-ink-soft/40'
                          }`}
                        >
                          {active && <span className="h-2.5 w-2.5 rounded-full brand-gradient" />}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs text-ink-soft">{opt.hint}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-soft">
              <Lock size={12} /> Payments are handled securely server-side — card and wallet secrets never touch this browser.
            </p>
          </section>
        </div>

        {/* ── Right: summary ── */}
        <aside className="glass h-fit rounded-3xl p-6 lg:sticky lg:top-24">
          <h2 className="font-display text-lg font-bold">Order summary</h2>
          <p className="mt-0.5 text-xs text-ink-soft">{count} item{count === 1 ? '' : 's'}</p>

          <ul className="mt-4 flex max-h-72 flex-col gap-3 overflow-auto pr-1">
            {items.map((item) => (
              <li key={item.variantId} className="flex gap-3">
                <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/60">
                  {item.image ? (
                    <img src={item.image} alt={item.productName} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  ) : (
                    <Smartphone size={20} className="text-brand-300" />
                  )}
                </div>
                <div className="flex-1 text-sm">
                  <p className="font-semibold leading-tight">{item.productName}</p>
                  <p className="text-xs text-ink-soft">{item.variantLabel}</p>
                  <p className="text-xs text-ink-soft">Qty {item.quantity}</p>
                </div>
                <p className="text-sm font-semibold">{formatPHP(item.unitPrice * item.quantity)}</p>
              </li>
            ))}
          </ul>

          <dl className="mt-4 space-y-2 border-t border-white/60 pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-soft">Subtotal</dt>
              <dd className="font-semibold">{formatPHP(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">Delivery</dt>
              <dd className={deliveryFee === 0 ? 'font-semibold text-brand-700' : 'font-semibold'}>
                {deliveryFee === 0 ? 'FREE' : formatPHP(deliveryFee)}
              </dd>
            </div>
          </dl>

          {deliveryFee > 0 && amountToFreeDelivery > 0 && (
            <p className="mt-2 text-xs text-ink-soft">
              Add {formatPHP(amountToFreeDelivery)} more for free delivery.
            </p>
          )}

          <div className="mt-4 flex items-center justify-between border-t border-white/60 pt-4">
            <span className="font-display font-bold">Total</span>
            <span className="font-display text-xl font-extrabold text-gradient">{formatPHP(total)}</span>
          </div>
          <p className="mt-1 text-right text-[11px] text-ink-soft">Confirmed securely by the server at order time.</p>

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full brand-gradient px-6 py-3.5 font-semibold text-white shadow-lg shadow-brand-600/25 transition-transform hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Placing order…
              </>
            ) : (
              <>
                Place order · {formatPHP(total)} <ArrowRight size={16} />
              </>
            )}
          </button>

          <Link
            to="/cart"
            className="mt-3 block text-center text-sm font-semibold text-brand-700 hover:text-brand-800"
          >
            Back to cart
          </Link>
        </aside>
      </form>
    </div>
  );
}
