import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowRight,
  BatteryMedium,
  Box,
  CheckCircle2,
  ClipboardList,
  Cable,
  Loader2,
  Search,
  Smartphone,
} from 'lucide-react';
import { useBranches } from '../hooks/useBranches';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { createTradeIn } from '../services/tradeIns';
import { ApiError } from '../services/http';
import { BranchPicker } from '../components/store/BranchPicker';
import { CheckboxCard, SelectField, TextAreaField, TextField } from '../components/store/FormControls';
import { CONDITION_LABELS, CONDITION_ORDER } from '../config/condition';
import { BUSINESS } from '../config/business';
import { formatBranchLocation, formatDateTime } from '../utils/format';
import type { ProductCondition } from '../types/api';
import type { CreateTradeInRequest, TradeInDTO } from '../types/tradeIn';

const WIDTH = 'mx-auto w-[min(100%-1.5rem,76rem)]';

// ── Form state (flat for binding; nested on submit) ──────────────────────────

interface FormState {
  name: string;
  email: string;
  phone: string;
  brand: string;
  model: string;
  storage: string;
  color: string;
  condition: ProductCondition;
  batteryHealth: string;
  imei: string;
  issues: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  email: '',
  phone: '',
  brand: '',
  model: '',
  storage: '',
  color: '',
  // Most trade-ins are used units; staff confirm the real condition on inspection.
  condition: 'PREOWNED',
  batteryHealth: '',
  imei: '',
  issues: '',
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

// Mirrors the server's createTradeInSchema for fast feedback. The server
// re-validates everything — client-side validation is never the only check.
function validate(form: FormState): FieldErrors {
  const e: FieldErrors = {};

  const name = form.name.trim();
  if (name.length < 2) e.name = 'Please enter your full name.';
  else if (name.length > 80) e.name = 'Name is too long.';

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) e.email = 'Enter a valid email address.';

  const phone = form.phone.replace(/[\s-]/g, '');
  if (!/^(?:\+63|0)9\d{9}$/.test(phone)) e.phone = 'Enter a valid PH mobile (e.g. 0917 123 4567).';

  const brand = form.brand.trim();
  if (brand.length < 1) e.brand = 'Device brand is required.';
  else if (brand.length > 60) e.brand = 'Brand is too long.';

  const model = form.model.trim();
  if (model.length < 1) e.model = 'Device model is required.';
  else if (model.length > 80) e.model = 'Model is too long.';

  if (form.storage.trim().length > 40) e.storage = 'Storage is too long.';
  if (form.color.trim().length > 60) e.color = 'Color is too long.';

  const battery = form.batteryHealth.trim();
  if (battery) {
    const n = Number(battery);
    if (!Number.isInteger(n) || n < 0 || n > 100) e.batteryHealth = 'Enter a whole number from 0 to 100.';
  }

  const imei = form.imei.trim();
  if (imei.length > 20) e.imei = 'IMEI is too long (max 20 characters).';

  if (form.issues.trim().length > 1000) e.issues = 'Please keep this under 1000 characters.';
  return e;
}

const CONDITION_OPTIONS = CONDITION_ORDER.map((c) => ({ value: c, label: CONDITION_LABELS[c] }));

const STEPS = [
  {
    icon: <ClipboardList size={18} />,
    title: 'You describe the device',
    body: 'Fill in the details below. It takes a minute and costs nothing.',
  },
  {
    icon: <Search size={18} />,
    title: 'Our staff inspect it',
    body: 'We check the unit at your chosen branch — battery, screen, and overall condition.',
  },
  {
    icon: <CheckCircle2 size={18} />,
    title: 'You get a real offer',
    body: 'Our staff give you the price. Nothing is auto-computed, and you are free to decline.',
  },
];

export function TradeInPage() {
  useDocumentTitle('Sell or trade your phone');
  const { data: branches } = useBranches();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [branchId, setBranchId] = useState('');
  const [hasBox, setHasBox] = useState(false);
  const [hasCharger, setHasCharger] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<TradeInDTO | null>(null);

  function onChange(
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((prev) => (prev[name as keyof FormState] ? { ...prev, [name]: undefined } : prev));
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setBranchId('');
    setHasBox(false);
    setHasCharger(false);
    setErrors({});
    setFormError(null);
    setSubmitted(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setFormError(null);

    const found = validate(form);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      setFormError('Please fix the highlighted fields.');
      return;
    }
    setErrors({});

    const battery = form.batteryHealth.trim();
    const req: CreateTradeInRequest = {
      customer: { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() },
      device: {
        brand: form.brand.trim(),
        model: form.model.trim(),
        condition: form.condition,
        hasBox,
        hasCharger,
        ...(form.storage.trim() ? { storage: form.storage.trim() } : {}),
        ...(form.color.trim() ? { color: form.color.trim() } : {}),
        ...(battery ? { batteryHealth: Number(battery) } : {}),
        ...(form.imei.trim() ? { imei: form.imei.trim() } : {}),
        ...(form.issues.trim() ? { issues: form.issues.trim() } : {}),
      },
      ...(branchId ? { branchId } : {}),
    };

    setSubmitting(true);
    try {
      const tradeIn = await createTradeIn(req);
      setSubmitted(tradeIn);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(
          err.status === 422 ? 'Some details need fixing — please review and try again.' : err.message,
        );
      } else {
        setFormError('Something went wrong sending your application. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) return <TradeInSubmitted tradeIn={submitted} onAnother={resetForm} />;

  return (
    <div className={`${WIDTH} pt-10 pb-16`}>
      <h1 className="font-display text-3xl font-extrabold sm:text-4xl">Sell or trade your phone</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Tell us what you have and our staff will inspect it and give you an offer. No account needed, and
        no obligation to accept.
      </p>

      {/* ── How it works ── */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {STEPS.map((step, i) => (
          <motion.div
            key={step.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: i * 0.06 }}
            className="glass rounded-3xl p-5"
          >
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl brand-gradient text-white">
                {step.icon}
              </span>
              <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Step {i + 1}</p>
            </div>
            <h2 className="mt-3 font-display font-bold">{step.title}</h2>
            <p className="mt-1 text-sm text-ink-soft">{step.body}</p>
          </motion.div>
        ))}
      </div>

      <form onSubmit={onSubmit} className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]" noValidate>
        {/* ── Left: the application ── */}
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

          <section className="glass rounded-3xl p-6">
            <h2 className="font-display text-lg font-bold">Your device</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <TextField label="Brand" name="brand" value={form.brand} onChange={onChange} error={errors.brand} placeholder="Apple" maxLength={60} />
              <TextField label="Model" name="model" value={form.model} onChange={onChange} error={errors.model} placeholder="iPhone 12 Pro" maxLength={80} />
              <TextField label="Storage" name="storage" value={form.storage} onChange={onChange} error={errors.storage} placeholder="128GB" optional maxLength={40} />
              <TextField label="Color" name="color" value={form.color} onChange={onChange} error={errors.color} placeholder="Graphite" optional maxLength={60} />
              <SelectField label="Condition" name="condition" value={form.condition} onChange={onChange} error={errors.condition} options={CONDITION_OPTIONS} hint="Your best guess — staff confirm on inspection." />
              <TextField label="Battery health %" name="batteryHealth" value={form.batteryHealth} onChange={onChange} error={errors.batteryHealth} placeholder="87" inputMode="numeric" optional hint="Settings → Battery → Battery Health, if you know it." />
              <TextField label="IMEI / serial" name="imei" value={form.imei} onChange={onChange} error={errors.imei} placeholder="Dial *#06# to see it" optional maxLength={20} className="sm:col-span-2" />
            </div>

            <p className="mt-5 mb-2 text-sm font-semibold text-ink">What's included?</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <CheckboxCard label="Original box" checked={hasBox} onChange={setHasBox} icon={<Box size={18} />} hint="Complete packaging usually means a better offer." />
              <CheckboxCard label="Charger / cable" checked={hasCharger} onChange={setHasCharger} icon={<Cable size={18} />} hint="Include the original cable if you still have it." />
            </div>

            <div className="mt-4">
              <TextAreaField label="Issues or notes" name="issues" value={form.issues} onChange={onChange} error={errors.issues} optional rows={4} maxLength={1000} placeholder="e.g. small scratch on the back, screen replaced last year, Face ID not working…" hint="Being upfront speeds up the inspection — surprises slow it down." />
            </div>
          </section>

          <section className="glass rounded-3xl p-6">
            <h2 className="font-display text-lg font-bold">Contact details</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <TextField label="Full name" name="name" value={form.name} onChange={onChange} error={errors.name} placeholder="Juan Dela Cruz" autoComplete="name" className="sm:col-span-2" />
              <TextField label="Email" name="email" value={form.email} onChange={onChange} error={errors.email} placeholder="you@example.com" type="email" inputMode="email" autoComplete="email" />
              <TextField label="Mobile number" name="phone" value={form.phone} onChange={onChange} error={errors.phone} placeholder="0917 123 4567" type="tel" inputMode="tel" autoComplete="tel" />
            </div>
            <p className="mt-3 text-xs text-ink-soft">
              We use these only to contact you about this trade-in. No account is created.
            </p>
          </section>

          {branches.length > 0 && (
            <section className="glass rounded-3xl p-6">
              <h2 className="font-display text-lg font-bold">Preferred branch</h2>
              <p className="mt-1 mb-4 text-sm text-ink-soft">
                Where would you like the device inspected? You can change this later.
              </p>
              <BranchPicker
                branches={branches}
                value={branchId}
                onChange={setBranchId}
                name="tradeInBranch"
                noneLabel="No preference — contact me first"
              />
            </section>
          )}
        </div>

        {/* ── Right: summary / submit ── */}
        <aside className="glass h-fit rounded-3xl p-6 lg:sticky lg:top-24">
          <h2 className="font-display text-lg font-bold">Ready to send?</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Submitting doesn't commit you to anything. Our staff review each application and reply with an
            offer.
          </p>

          <div className="mt-4 rounded-2xl border border-white/60 bg-white/50 p-4">
            <p className="flex items-start gap-2 text-xs text-ink-soft">
              <BatteryMedium size={14} className="mt-0.5 shrink-0 text-brand-600" />
              <span>
                We don't show an instant online estimate — a phone's real value depends on its actual
                condition, so a person prices it, not a formula.
              </span>
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full brand-gradient px-6 py-3.5 font-semibold text-white shadow-lg shadow-brand-600/25 transition-transform hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Sending…
              </>
            ) : (
              <>
                Submit trade-in <ArrowRight size={16} />
              </>
            )}
          </button>

          <p className="mt-4 text-xs text-ink-soft">
            Prefer to talk first? Call or text{' '}
            <a href={BUSINESS.phoneHref} className="font-semibold text-brand-700 hover:text-brand-800">
              {BUSINESS.phone}
            </a>
            .
          </p>
        </aside>
      </form>
    </div>
  );
}

/* ── confirmation ────────────────────────────────────────────────────────── */

function TradeInSubmitted({ tradeIn, onAnother }: { tradeIn: TradeInDTO; onAnother: () => void }) {
  const device = tradeIn.device;
  const specs = [device.storage, device.color, CONDITION_LABELS[device.condition]]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className={`${WIDTH} pt-10 pb-16`}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass mx-auto max-w-2xl rounded-3xl p-8 sm:p-10"
      >
        <CheckCircle2 className="text-brand-600" size={44} />
        <h1 className="mt-4 font-display text-3xl font-extrabold">Trade-in submitted</h1>
        <p className="mt-2 text-ink-soft">
          Thanks, {tradeIn.customer.name.split(' ')[0]}. Our staff will review your device and get back to
          you with an offer.
        </p>

        <div className="mt-6 rounded-2xl border border-white/60 bg-white/60 p-5">
          <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Your reference</p>
          <p className="mt-1 font-display text-2xl font-extrabold text-gradient">{tradeIn.reference}</p>
          <p className="mt-1 text-xs text-ink-soft">
            Keep this — quote it when you call or visit. Submitted {formatDateTime(tradeIn.createdAt)}.
          </p>
        </div>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/70 text-brand-600">
              <Smartphone size={18} />
            </span>
            <div className="text-sm">
              <dt className="font-semibold text-ink">Device</dt>
              <dd className="text-ink-soft">
                {device.brand} {device.model}
                {specs && <span className="block text-xs">{specs}</span>}
              </dd>
            </div>
          </div>
          {tradeIn.branch && (
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/70 text-brand-600">
                <Search size={18} />
              </span>
              <div className="text-sm">
                <dt className="font-semibold text-ink">Inspection branch</dt>
                <dd className="text-ink-soft">
                  {tradeIn.branch.name}
                  {formatBranchLocation(tradeIn.branch) && (
                    <span className="block text-xs">{formatBranchLocation(tradeIn.branch)}</span>
                  )}
                </dd>
              </div>
            </div>
          )}
        </dl>

        <div className="mt-6 border-t border-white/60 pt-5 text-sm text-ink-soft">
          <p className="font-semibold text-ink">What happens next</p>
          <p className="mt-1">
            A staff member inspects the unit and prices it — there is no automatic valuation. We'll reach
            you on {tradeIn.customer.phone} or {tradeIn.customer.email}.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/shop"
            className="inline-flex items-center gap-2 rounded-full brand-gradient px-6 py-3 font-semibold text-white shadow-lg shadow-brand-600/25 transition-transform hover:scale-[1.02]"
          >
            Browse the shop <ArrowRight size={16} />
          </Link>
          <button
            type="button"
            onClick={onAnother}
            className="inline-flex items-center gap-2 rounded-full glass px-6 py-3 font-semibold text-ink transition-transform hover:scale-[1.02]"
          >
            Trade in another device
          </button>
        </div>
      </motion.div>
    </div>
  );
}
