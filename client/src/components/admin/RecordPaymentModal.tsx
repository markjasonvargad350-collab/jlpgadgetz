import { useEffect, useState } from 'react';
import { Banknote } from 'lucide-react';
import { recordInstallmentPayment } from '../../services/adminInstallments';
import { ApiError } from '../../services/http';
import { Field, Input, Select } from './ui/Field';
import { Modal } from './ui/Modal';
import { Spinner } from './ui/Spinner';
import { formatPHPExact, formatDate } from '../../utils/format';
import type { PaymentMethod } from '../../types/order';
import type { InstallmentDTO, InstallmentScheduleRow } from '../../types/installment';
import type { RecordPaymentInput } from '../../types/admin';

/** Shared with the installment detail page so labels never drift apart. */
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  COD: 'Cash (COD)',
  GCASH: 'GCash',
  BANK_TRANSFER: 'Bank transfer',
};

const METHODS: PaymentMethod[] = ['COD', 'GCASH', 'BANK_TRANSFER'];
const MAX_AMOUNT = 100_000_000;

/**
 * Record a payment against ONE month of a plan's schedule.
 *
 * The ledger is additive: this only ever increases `amountPaid` on the row the
 * staff member picked — no row is rewritten or deleted. Overpaying is blocked
 * here for fast feedback and rejected again server-side (422), which is the real
 * guard. Partial payments are allowed: the row stays unpaid until it's settled.
 */
export function RecordPaymentModal({
  planId,
  row,
  open,
  onClose,
  onRecorded,
}: {
  planId: string;
  row: InstallmentScheduleRow | null;
  open: boolean;
  onClose: () => void;
  onRecorded: (plan: InstallmentDTO) => void;
}) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'' | PaymentMethod>('');
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = row ? Math.max(0, row.amountDue - row.amountPaid) : 0;

  // Reset (and pre-fill with the outstanding amount) whenever a new row opens.
  useEffect(() => {
    if (open && row) {
      const outstanding = Math.max(0, row.amountDue - row.amountPaid);
      setAmount(outstanding > 0 ? outstanding.toFixed(2) : '');
      setMethod(row.method ?? '');
      setReference(row.reference ?? '');
      setError(null);
      setSubmitting(false);
    }
  }, [open, row?.id]);

  if (!row) return null;

  function validate(): RecordPaymentInput | string {
    const n = Number(amount);
    if (!amount.trim() || !Number.isFinite(n)) return 'Enter the amount received.';
    if (n <= 0) return 'Amount must be greater than zero.';
    if (n > remaining) return `That’s more than the ${formatPHPExact(remaining)} still owed on this month.`;
    if (n > MAX_AMOUNT) return 'That amount is unrealistically high.';
    return {
      amount: n,
      ...(method ? { method } : {}),
      ...(reference.trim() ? { reference: reference.trim() } : {}),
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input = validate();
    if (typeof input === 'string') {
      setError(input);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const plan = await recordInstallmentPayment(planId, row!.id, input);
      onRecorded(plan);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not record the payment. Please try again.');
      setSubmitting(false);
    }
  }

  const entered = Number(amount);
  const willSettle = Number.isFinite(entered) && entered > 0 && entered >= remaining;

  return (
    <Modal
      open={open}
      onClose={submitting ? () => {} : onClose}
      title={`Record payment — month ${row.sequence}`}
      size="md"
    >
      <div className="mb-4 rounded-2xl bg-white/50 px-4 py-3 text-sm">
        <p className="font-semibold text-ink">Due {formatDate(row.dueDate)}</p>
        <dl className="mt-2 space-y-1 text-xs">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-soft">Amount due</dt>
            <dd className="font-semibold text-ink">{formatPHPExact(row.amountDue)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-soft">Already paid</dt>
            <dd className="font-semibold text-ink">{formatPHPExact(row.amountPaid)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-soft">Still owed</dt>
            <dd className="font-semibold text-coral">{formatPHPExact(remaining)}</dd>
          </div>
        </dl>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field
          label="Amount received (₱)"
          htmlFor="pay-amount"
          hint={`Up to ${formatPHPExact(remaining)}. A smaller amount is recorded as a partial payment.`}
        >
          <Input
            id="pay-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setError(null);
            }}
            placeholder={remaining.toFixed(2)}
          />
        </Field>

        <Field label="Paid with" htmlFor="pay-method" hint="Optional — stored on the schedule row.">
          <Select
            id="pay-method"
            value={method}
            onChange={(e) => setMethod(e.target.value as '' | PaymentMethod)}
          >
            <option value="">Not specified</option>
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABEL[m]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Reference" htmlFor="pay-ref" hint="Optional — receipt no., GCash ref, deposit slip…">
          <Input
            id="pay-ref"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            maxLength={120}
            placeholder="e.g. GC-8842011"
          />
        </Field>

        {willSettle && (
          <p className="text-sm text-ink-soft">
            This settles month {row.sequence} in full.
          </p>
        )}

        {error && (
          <div role="alert" className="rounded-2xl bg-coral/10 px-4 py-3 text-sm text-coral ring-1 ring-coral/20">
            {error}
          </div>
        )}

        <div className="mt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-full bg-white/60 px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-white/80 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 rounded-full brand-gradient px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-70 disabled:hover:scale-100"
          >
            {submitting ? <Spinner size={15} tone="light" /> : <Banknote size={16} />}
            Record payment
          </button>
        </div>
      </form>
    </Modal>
  );
}
