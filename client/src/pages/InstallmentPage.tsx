import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Loader2,
  ReceiptText,
  Smartphone,
  Wallet,
} from 'lucide-react';
import { useBranches } from '../hooks/useBranches';
import { useProducts } from '../hooks/useProducts';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { getProduct } from '../services/products';
import { createInstallment, quoteInstallment } from '../services/installments';
import { ApiError } from '../services/http';
import { BranchPicker } from '../components/store/BranchPicker';
import { TextField } from '../components/store/FormControls';
import { INSTALLMENT_TERMS, computeMonthly, minDownPayment } from '../config/installment';
import { CONDITION_LABELS } from '../config/condition';
import { BUSINESS } from '../config/business';
import { formatBranchLocation, formatDate, formatPHP, formatPHPExact } from '../utils/format';
import { sized } from '../utils/image';
import type { ProductCard, ProductDetail, ProductVariant } from '../types/api';
import type { CreateInstallmentRequest, InstallmentDTO, InstallmentQuote } from '../types/installment';

const WIDTH = 'mx-auto w-[min(100%-1.5rem,76rem)]';

// ── Contact form ─────────────────────────────────────────────────────────────

interface FormState {
  name: string;
  email: string;
  phone: string;
}

const EMPTY_FORM: FormState = { name: '', email: '', phone: '' };

type FieldErrors = Partial<Record<keyof FormState | 'downPayment', string>>;

/** Mirrors createInstallmentSchema's customer rules; the server re-validates. */
function validateContact(form: FormState): FieldErrors {
  const e: FieldErrors = {};
  const name = form.name.trim();
  if (name.length < 2) e.name = 'Please enter your full name.';
  else if (name.length > 80) e.name = 'Name is too long.';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) e.email = 'Enter a valid email address.';
  const phone = form.phone.replace(/[\s-]/g, '');
  if (!/^(?:\+63|0)9\d{9}$/.test(phone)) e.phone = 'Enter a valid PH mobile (e.g. 0917 123 4567).';
  return e;
}

function variantLabel(v: ProductVariant): string {
  return `${v.storage} · ${v.color} · ${CONDITION_LABELS[v.condition]}`;
}

/**
 * What a plan actually divides: the option's installment base price, or its cash
 * price when the shop hasn't set a separate one. Mirrors the server
 * (`installment.service.ts` → `variant.installmentPrice ?? variant.price`), which
 * has the last word on every figure here.
 */
function financedPrice(v: ProductVariant): number {
  return v.installmentPrice ?? v.price;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function InstallmentPage() {
  useDocumentTitle('Installment plans');
  const [searchParams] = useSearchParams();
  const { data: branches } = useBranches();

  // Deep-link support: the product page links here with ?product=<slug>&variantId=<id>.
  const [productSlug, setProductSlug] = useState(() => searchParams.get('product') ?? '');
  const [variantId, setVariantId] = useState(() => searchParams.get('variantId') ?? '');
  const [termMonths, setTermMonths] = useState<number>(6);
  const [downPaymentInput, setDownPaymentInput] = useState('');

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [branchId, setBranchId] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<InstallmentDTO | null>(null);

  // Eligible catalog — the server filters to installmentAvailable products, so
  // nothing here has to be truncated or filtered client-side.
  const eligible = useProducts({ installment: true, pageSize: 60, sort: 'price_asc' });

  // Selected product detail (for the variant chips + minimum down payment).
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [productError, setProductError] = useState<string | null>(null);

  useEffect(() => {
    if (!productSlug) {
      setProduct(null);
      setProductError(null);
      return;
    }
    let active = true;
    setProductError(null);
    getProduct(productSlug)
      .then((p) => {
        if (active) setProduct(p);
      })
      .catch(() => {
        if (active) setProductError('Couldn’t load that product. Pick one below instead.');
      });
    return () => {
      active = false;
    };
  }, [productSlug]);

  const selectedVariant = useMemo(
    () => product?.variants.find((v) => v.id === variantId) ?? null,
    [product, variantId],
  );

  // Down payment floor comes from the product when we have it; the server
  // enforces the real one either way (422 with the exact minimum).
  const downPaymentFloor = useMemo(() => {
    if (!product || !selectedVariant) return 0;
    return minDownPayment(financedPrice(selectedVariant), product.installmentMinDownPct);
  }, [product, selectedVariant]);

  const downPayment = useMemo(() => {
    const n = Number(downPaymentInput.replace(/,/g, '').trim());
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [downPaymentInput]);

  // ── Server quote (authoritative preview) ──
  const [quote, setQuote] = useState<InstallmentQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  useEffect(() => {
    if (!variantId) {
      setQuote(null);
      setQuoteError(null);
      return;
    }
    let active = true;
    setQuoteLoading(true);
    // Debounced so typing a down payment doesn't fire a request per keystroke.
    const timer = window.setTimeout(() => {
      quoteInstallment({ variantId, termMonths, downPayment })
        .then((q) => {
          if (!active) return;
          setQuote(q);
          setQuoteError(null);
          setQuoteLoading(false);
        })
        .catch((err: unknown) => {
          if (!active) return;
          setQuote(null);
          setQuoteError(
            err instanceof ApiError ? err.message : 'Couldn’t calculate this plan. Please try again.',
          );
          setQuoteLoading(false);
        });
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [variantId, termMonths, downPayment]);

  const chooseProduct = useCallback((card: ProductCard) => {
    setProductSlug(card.slug);
    setVariantId('');
    setQuote(null);
    setQuoteError(null);
    setDownPaymentInput('');
  }, []);

  function clearSelection() {
    setProductSlug('');
    setVariantId('');
    setProduct(null);
    setProductError(null);
    setQuote(null);
    setQuoteError(null);
    setDownPaymentInput('');
  }

  function onContactChange(e: ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((prev) => (prev[name as keyof FormState] ? { ...prev, [name]: undefined } : prev));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setFormError(null);

    if (!variantId || !quote) {
      setFormError('Choose a device and a term first.');
      return;
    }

    const found = validateContact(form);
    if (downPayment > 0 && downPayment >= quote.price) {
      found.downPayment = 'Down payment must be less than the installment price.';
    }
    if (Object.keys(found).length > 0) {
      setErrors(found);
      setFormError('Please fix the highlighted fields.');
      return;
    }
    setErrors({});

    const req: CreateInstallmentRequest = {
      customer: { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() },
      // Only the option, the term and the down payment leave the browser — the
      // server re-derives the price, principal and every monthly from the DB.
      variantId,
      termMonths,
      ...(downPayment > 0 ? { downPayment } : {}),
      ...(branchId ? { branchId } : {}),
    };

    setSubmitting(true);
    try {
      const plan = await createInstallment(req);
      setSubmitted(plan);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(
          err.status === 422
            ? err.message
            : err.status === 404
              ? 'That option is no longer available. Please pick another.'
              : err.message,
        );
      } else {
        setFormError('Something went wrong sending your application. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) return <InstallmentSubmitted plan={submitted} />;

  const eligibleItems = eligible.data?.items ?? [];
  // Show the catalog picker unless something is already selected — either a
  // product we could load, or a variant deep-linked from a product page (which
  // we can still quote and describe from the quote itself).
  const showPicker = !((productSlug && !productError) || variantId);
  // The server lets the final month absorb the rounding remainder, so it can
  // differ from the headline monthly by a few centavos — worth stating.
  const lastRow = quote?.schedule.at(-1) ?? null;

  return (
    <div className={`${WIDTH} pt-10 pb-16`}>
      <h1 className="font-display text-3xl font-extrabold sm:text-4xl">Installment plans</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Pay for your device monthly. The monthly amount is simply the{' '}
        <strong className="font-semibold text-ink">
          installment price divided by the number of months
        </strong>{' '}
        — we don’t add interest or service fees. Installment pricing sits a little above the cash price;
        both are shown on every option below. Apply online and our staff will contact you to finalise it.
      </p>

      <form onSubmit={onSubmit} className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]" noValidate>
        <div className="flex flex-col gap-6">
          {formError && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3 rounded-2xl border border-coral/40 bg-coral/10 p-4 text-sm text-coral"
              role="alert"
            >
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <p className="font-semibold">{formError}</p>
            </motion.div>
          )}

          {/* ── 1. Device ── */}
          <section className="glass rounded-3xl p-6">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-lg font-bold">1. Choose a device</h2>
              {!showPicker && (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-sm font-semibold text-brand-700 hover:text-brand-800"
                >
                  Change
                </button>
              )}
            </div>

            {productError && (
              <p className="mt-3 text-sm font-medium text-coral" role="alert">
                {productError}
              </p>
            )}

            {showPicker && (
              <>
                {eligible.loading && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/50" />
                    ))}
                  </div>
                )}
                {!eligible.loading && eligible.error && (
                  <p className="mt-3 text-sm font-medium text-coral" role="alert">
                    {eligible.error}
                  </p>
                )}
                {!eligible.loading && !eligible.error && eligibleItems.length === 0 && (
                  <p className="mt-3 text-sm text-ink-soft">
                    No products are set up for installment yet. Call or text{' '}
                    <a href={BUSINESS.phoneHref} className="font-semibold text-brand-700 hover:text-brand-800">
                      {BUSINESS.phone}
                    </a>{' '}
                    and we’ll sort it out with you directly.
                  </p>
                )}
                {eligibleItems.length > 0 && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {eligibleItems.map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => chooseProduct(card)}
                        className="flex items-center gap-3 rounded-2xl border border-white/60 bg-white/40 p-3 text-left transition-colors hover:bg-white/70"
                      >
                        <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/60">
                          {card.image ? (
                            <img
                              src={sized(card.image, 'sm')}
                              alt={card.imageAlt}
                              loading="lazy"
                              decoding="async"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Smartphone size={20} className="text-brand-300" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-ink">{card.name}</span>
                          <span className="block text-xs text-ink-soft">
                            installment from {formatPHP(card.installmentPriceFrom ?? card.priceFrom)}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Chosen product + its options */}
            {!showPicker && product && (
              <div className="mt-4">
                <p className="font-display text-lg font-bold text-gradient">{product.name}</p>
                <p className="mt-0.5 text-xs text-ink-soft">
                  Minimum down payment:{' '}
                  {product.installmentMinDownPct > 0
                    ? `${product.installmentMinDownPct}% of the installment price`
                    : 'none'}
                </p>

                <p className="mt-4 mb-2 text-sm font-semibold text-ink">Pick an option</p>
                <div className="grid gap-2">
                  {product.variants.map((v) => {
                    const active = v.id === variantId;
                    return (
                      <label
                        key={v.id}
                        className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl border p-3.5 transition-colors ${
                          active
                            ? 'border-brand-400 bg-white/70'
                            : 'border-white/60 bg-white/40 hover:bg-white/60'
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="variantId"
                            value={v.id}
                            checked={active}
                            onChange={() => setVariantId(v.id)}
                            className="sr-only"
                          />
                          <span
                            className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                              active ? 'border-brand-500' : 'border-ink-soft/40'
                            }`}
                          >
                            {active && <span className="h-2.5 w-2.5 rounded-full brand-gradient" />}
                          </span>
                          <span className="text-sm">
                            <span className="font-semibold text-ink">{variantLabel(v)}</span>
                            {v.batteryHealth != null && (
                              <span className="block text-xs text-ink-soft">
                                Battery health {v.batteryHealth}%
                              </span>
                            )}
                            {v.conditionNote && (
                              <span className="block text-xs text-ink-soft">{v.conditionNote}</span>
                            )}
                          </span>
                        </span>
                        <span className="shrink-0 text-right text-sm">
                          <span className="block font-bold">{formatPHP(financedPrice(v))}</span>
                          {v.installmentPrice != null && v.installmentPrice !== v.price && (
                            <span className="block text-[11px] font-medium text-ink-soft">
                              {formatPHP(v.price)} cash
                            </span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Deep-linked without a slug: describe the option from the quote. */}
            {!showPicker && !product && quote && (
              <div className="mt-4 rounded-2xl border border-white/60 bg-white/50 p-4">
                <p className="font-semibold text-ink">{quote.productName}</p>
                <p className="text-sm text-ink-soft">
                  {quote.variantLabel} · {CONDITION_LABELS[quote.condition]} · {formatPHP(quote.price)} on
                  installment
                </p>
              </div>
            )}
          </section>

          {/* ── 2. Term + down payment ── */}
          <section className="glass rounded-3xl p-6">
            <h2 className="font-display text-lg font-bold">2. Choose your term</h2>
            <p className="mt-1 text-sm text-ink-soft">
              {selectedVariant || quote
                ? 'Monthly figures are confirmed by JLP’s system before you submit.'
                : 'Pick a device above to see the monthly amounts.'}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {INSTALLMENT_TERMS.map((term) => {
                const active = term === termMonths;
                const basePrice = (selectedVariant ? financedPrice(selectedVariant) : quote?.price) ?? 0;
                // Preview only — the aside shows the server-confirmed figure.
                const preview = basePrice ? computeMonthly(basePrice, term, downPayment) : 0;
                return (
                  <label
                    key={term}
                    className={`cursor-pointer rounded-2xl border p-4 text-center transition-colors ${
                      active ? 'border-brand-400 bg-white/70' : 'border-white/60 bg-white/40 hover:bg-white/60'
                    }`}
                  >
                    <input
                      type="radio"
                      name="termMonths"
                      value={term}
                      checked={active}
                      onChange={() => setTermMonths(term)}
                      className="sr-only"
                    />
                    <span className="block font-display text-lg font-bold text-ink">{term} mo</span>
                    <span className="mt-0.5 block text-xs text-ink-soft">
                      {preview > 0 ? `≈ ${formatPHP(preview)}/mo` : '—'}
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="mt-5 max-w-xs">
              <TextField
                label="Down payment"
                name="downPayment"
                value={downPaymentInput}
                onChange={(e) => {
                  setDownPaymentInput(e.target.value);
                  setErrors((prev) => (prev.downPayment ? { ...prev, downPayment: undefined } : prev));
                }}
                error={errors.downPayment}
                placeholder="0"
                inputMode="decimal"
                optional
                hint={
                  downPaymentFloor > 0
                    ? `At least ${formatPHP(downPaymentFloor)} for this option.`
                    : 'Paying something up front lowers each month.'
                }
              />
            </div>
          </section>

          {/* ── 3. Contact ── */}
          <section className="glass rounded-3xl p-6">
            <h2 className="font-display text-lg font-bold">3. Contact details</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <TextField label="Full name" name="name" value={form.name} onChange={onContactChange} error={errors.name} placeholder="Juan Dela Cruz" autoComplete="name" className="sm:col-span-2" />
              <TextField label="Email" name="email" value={form.email} onChange={onContactChange} error={errors.email} placeholder="you@example.com" type="email" inputMode="email" autoComplete="email" />
              <TextField label="Mobile number" name="phone" value={form.phone} onChange={onContactChange} error={errors.phone} placeholder="0917 123 4567" type="tel" inputMode="tel" autoComplete="tel" />
            </div>
            <p className="mt-3 text-xs text-ink-soft">
              No account needed. We use these only to contact you about this application.
            </p>
          </section>

          {branches.length > 0 && (
            <section className="glass rounded-3xl p-6">
              <h2 className="font-display text-lg font-bold">4. Preferred branch</h2>
              <p className="mt-1 mb-4 text-sm text-ink-soft">
                Where would you like to collect the unit and pay each month?
              </p>
              <BranchPicker
                branches={branches}
                value={branchId}
                onChange={setBranchId}
                name="installmentBranch"
                noneLabel="No preference — contact me first"
              />
            </section>
          )}
        </div>

        {/* ── Aside: the server-confirmed plan ── */}
        <aside className="glass h-fit rounded-3xl p-6 lg:sticky lg:top-24">
          <h2 className="font-display text-lg font-bold">Your plan</h2>

          {!variantId && (
            <p className="mt-2 text-sm text-ink-soft">
              Choose a device and an option to see the exact monthly amount.
            </p>
          )}

          {variantId && quoteError && (
            <p className="mt-3 rounded-2xl border border-coral/40 bg-coral/10 p-3 text-sm font-medium text-coral" role="alert">
              {quoteError}
            </p>
          )}

          {variantId && !quoteError && !quote && quoteLoading && (
            <p className="mt-3 flex items-center gap-2 text-sm text-ink-soft">
              <Loader2 size={14} className="animate-spin" /> Calculating…
            </p>
          )}

          {quote && (
            <div className={quoteLoading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
              <p className="mt-2 text-sm font-semibold text-ink">{quote.productName}</p>
              <p className="text-xs text-ink-soft">
                {quote.variantLabel} · {CONDITION_LABELS[quote.condition]}
              </p>

              <div className="mt-4 rounded-2xl border border-white/60 bg-white/60 p-4 text-center">
                <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
                  Monthly for {quote.termMonths} months
                </p>
                <p className="mt-1 font-display text-3xl font-extrabold text-gradient">
                  {formatPHPExact(quote.monthlyAmount)}
                </p>
                <p className="mt-1 text-[11px] text-ink-soft">
                  Computed by JLP’s system — no interest, no added fees.
                </p>
              </div>

              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-soft">Installment price</dt>
                  <dd className="font-semibold">{formatPHP(quote.price)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-soft">Down payment</dt>
                  <dd className="font-semibold">
                    {quote.downPayment > 0 ? formatPHPExact(quote.downPayment) : '—'}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-white/60 pt-2">
                  <dt className="text-ink-soft">Financed amount</dt>
                  <dd className="font-semibold">{formatPHPExact(quote.principal)}</dd>
                </div>
              </dl>

              {lastRow && lastRow.amountDue !== quote.monthlyAmount && (
                <p className="mt-2 text-[11px] text-ink-soft">
                  Last month adjusts to {formatPHPExact(lastRow.amountDue)} so the instalments add up
                  exactly.
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !quote}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full brand-gradient px-6 py-3.5 font-semibold text-white shadow-lg shadow-brand-600/25 transition-transform hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Sending…
              </>
            ) : (
              <>
                Apply for installment <ArrowRight size={16} />
              </>
            )}
          </button>

          <p className="mt-3 text-xs text-ink-soft">
            Applying doesn’t charge you anything. Our staff review each application and contact you to
            confirm the schedule and requirements.
          </p>
        </aside>
      </form>
    </div>
  );
}

/* ── confirmation ────────────────────────────────────────────────────────── */

function InstallmentSubmitted({ plan }: { plan: InstallmentDTO }) {
  return (
    <div className={`${WIDTH} pt-10 pb-16`}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass mx-auto max-w-2xl rounded-3xl p-8 sm:p-10"
      >
        <CheckCircle2 className="text-brand-600" size={44} />
        <h1 className="mt-4 font-display text-3xl font-extrabold">Application received</h1>
        <p className="mt-2 text-ink-soft">
          Thanks, {plan.customer.name.split(' ')[0]}. Your plan is pending review — our staff will contact
          you to confirm it.
        </p>

        <div className="mt-6 rounded-2xl border border-white/60 bg-white/60 p-5">
          <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Your reference</p>
          <p className="mt-1 font-display text-2xl font-extrabold text-gradient">{plan.reference}</p>
          <p className="mt-1 text-xs text-ink-soft">Keep this — quote it when you call or visit.</p>
        </div>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/70 text-brand-600">
              <Smartphone size={18} />
            </span>
            <div className="text-sm">
              <dt className="font-semibold text-ink">Device</dt>
              <dd className="text-ink-soft">
                {plan.product.name}
                {plan.product.variantLabel && (
                  <span className="block text-xs">{plan.product.variantLabel}</span>
                )}
              </dd>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/70 text-brand-600">
              <Wallet size={18} />
            </span>
            <div className="text-sm">
              <dt className="font-semibold text-ink">Monthly</dt>
              <dd className="text-ink-soft">
                {formatPHPExact(plan.monthlyAmount)} × {plan.termMonths} months
                <span className="block text-xs">
                  {plan.downPayment > 0
                    ? `after ${formatPHPExact(plan.downPayment)} down`
                    : 'no down payment'}
                </span>
              </dd>
            </div>
          </div>
          {plan.branch && (
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/70 text-brand-600">
                <ReceiptText size={18} />
              </span>
              <div className="text-sm">
                <dt className="font-semibold text-ink">Branch</dt>
                <dd className="text-ink-soft">
                  {plan.branch.name}
                  {formatBranchLocation(plan.branch) && (
                    <span className="block text-xs">{formatBranchLocation(plan.branch)}</span>
                  )}
                </dd>
              </div>
            </div>
          )}
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/70 text-brand-600">
              <CalendarClock size={18} />
            </span>
            <div className="text-sm">
              <dt className="font-semibold text-ink">Financed amount</dt>
              <dd className="text-ink-soft">{formatPHPExact(plan.principal)}</dd>
            </div>
          </div>
        </dl>

        {/* Proposed schedule — dates and amounts as recorded by the server. */}
        <div className="mt-6">
          <p className="font-semibold text-ink">Proposed schedule</p>
          <p className="mt-0.5 text-xs text-ink-soft">
            Dates start one month from today and shift if your start date changes on review.
          </p>
          <ul className="mt-3 divide-y divide-white/60 overflow-hidden rounded-2xl border border-white/60 bg-white/50 text-sm">
            {plan.schedule.map((row) => (
              <li key={row.id} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-ink-soft">
                  <span className="font-semibold text-ink">Month {row.sequence}</span> ·{' '}
                  {formatDate(row.dueDate)}
                </span>
                <span className="font-semibold">{formatPHPExact(row.amountDue)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 border-t border-white/60 pt-5 text-sm text-ink-soft">
          <p className="font-semibold text-ink">What happens next</p>
          <p className="mt-1">
            A staff member reviews your application and contacts you on {plan.customer.phone} to confirm the
            plan and what to bring. Nothing is charged until then.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/shop"
            className="inline-flex items-center gap-2 rounded-full brand-gradient px-6 py-3 font-semibold text-white shadow-lg shadow-brand-600/25 transition-transform hover:scale-[1.02]"
          >
            Keep browsing <ArrowRight size={16} />
          </Link>
          <Link
            to="/about"
            className="inline-flex items-center gap-2 rounded-full glass px-6 py-3 font-semibold text-ink transition-transform hover:scale-[1.02]"
          >
            Find a branch
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
