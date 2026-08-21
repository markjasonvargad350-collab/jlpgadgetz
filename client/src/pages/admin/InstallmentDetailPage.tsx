import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Ban, Banknote, CalendarClock, Save, Smartphone, Store, User, XCircle } from 'lucide-react';
import { useAdminInstallment } from '../../hooks/useAdminInstallment';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { updateInstallmentStatus } from '../../services/adminInstallments';
import { ApiError } from '../../services/http';
import { PageHeader } from '../../components/admin/ui/PageHeader';
import { Spinner, PageLoader } from '../../components/admin/ui/Spinner';
import {
  InstallmentStatusBadge,
  InstallmentPaymentStatusBadge,
} from '../../components/admin/ui/StatusBadge';
import { ConfirmDialog } from '../../components/admin/ui/ConfirmDialog';
import { Field, Textarea } from '../../components/admin/ui/Field';
import { DataTable } from '../../components/admin/ui/DataTable';
import type { Column } from '../../components/admin/ui/DataTable';
import { RecordPaymentModal, PAYMENT_METHOD_LABEL } from '../../components/admin/RecordPaymentModal';
import { formatPHP, formatPHPExact, formatDate, formatDateTime, formatBranchLocation } from '../../utils/format';
import type { InstallmentDTO, InstallmentScheduleRow, InstallmentStatus } from '../../types/installment';

// Client mirror of the server's ALLOWED_TRANSITIONS forward step. Rejecting and
// cancelling are offered separately; the server re-validates every move.
const NEXT_FORWARD: Partial<Record<InstallmentStatus, InstallmentStatus>> = {
  PENDING: 'APPROVED',
  APPROVED: 'ACTIVE',
  ACTIVE: 'COMPLETED',
};

const FORWARD_LABEL: Partial<Record<InstallmentStatus, string>> = {
  APPROVED: 'Approve plan',
  ACTIVE: 'Mark active',
  COMPLETED: 'Mark completed',
};

const REJECTABLE: InstallmentStatus[] = ['PENDING'];
const CANCELLABLE: InstallmentStatus[] = ['PENDING', 'APPROVED', 'ACTIVE'];
/** Statuses the server accepts payments on. */
const PAYABLE: InstallmentStatus[] = ['APPROVED', 'ACTIVE'];

const TERMINAL_NOTE: Partial<Record<InstallmentStatus, string>> = {
  COMPLETED: 'Plan fully paid',
  REJECTED: 'Application rejected',
  CANCELLED: 'Plan cancelled',
};

function BackLink() {
  return (
    <Link
      to="/admin/installments"
      className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft transition-colors hover:text-ink"
    >
      <ArrowLeft size={16} /> Back to installments
    </Link>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-ink-soft">{label}</dt>
      <dd className="text-right font-semibold text-ink">{value}</dd>
    </div>
  );
}

/** A row is overdue when it's still unpaid past its due date — never stored. */
function isOverdue(row: InstallmentScheduleRow): boolean {
  return row.status === 'PENDING' && new Date(row.dueDate).getTime() < Date.now();
}

/**
 * Internal notes. The status endpoint requires a status, so a notes-only save
 * re-sends the plan's current one — the server treats that as "no status change"
 * and only writes the notes.
 */
function NotesCard({ plan, onSaved }: { plan: InstallmentDTO; onSaved: () => void }) {
  const [notes, setNotes] = useState(plan.staffNotes ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (saving) return;
    setErr(null);
    setSaved(false);
    setSaving(true);
    try {
      await updateInstallmentStatus(plan.id, { status: plan.status, staffNotes: notes.trim() || null });
      setSaved(true);
      onSaved();
    } catch (e) {
      // A stale page can't write notes without also reverting the status — the
      // server refuses that, so pull the current state in.
      if (e instanceof ApiError && (e.status === 409 || e.status === 422)) onSaved();
      setErr(e instanceof ApiError ? e.message : 'Could not save the notes.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="glass rounded-3xl p-6">
      <Field label="Internal notes" htmlFor="ins-notes" hint="Only visible to your team.">
        <Textarea
          id="ins-notes"
          rows={4}
          maxLength={2000}
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            setSaved(false);
            setErr(null);
          }}
          placeholder="ID verified, first payment due on pickup…"
        />
      </Field>
      {err && (
        <div role="alert" className="mt-3 rounded-2xl bg-coral/10 px-4 py-3 text-sm text-coral ring-1 ring-coral/20">
          {err}
        </div>
      )}
      <button
        onClick={save}
        disabled={saving}
        className="mt-4 flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-sm font-semibold text-ink ring-1 ring-white/70 transition-colors hover:bg-white disabled:opacity-60"
      >
        {saving ? <Spinner size={14} /> : <Save size={14} />}
        {saved && !saving ? 'Saved' : 'Save notes'}
      </button>
    </section>
  );
}

export function InstallmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: plan, loading, error, reload } = useAdminInstallment(id ?? null);

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<InstallmentStatus | null>(null);
  const [payRow, setPayRow] = useState<InstallmentScheduleRow | null>(null);

  useDocumentTitle(plan ? `Installment ${plan.reference}` : 'Installment');

  if (loading && !plan) return <PageLoader label="Loading installment…" />;
  if (error || !plan) {
    return (
      <div>
        <BackLink />
        <div className="glass rounded-3xl p-8 text-center">
          <p className="font-display text-lg font-bold text-ink">Couldn’t load this plan</p>
          <p className="mt-1 text-sm text-ink-soft">{error ?? 'It may not exist.'}</p>
        </div>
      </div>
    );
  }

  const next = NEXT_FORWARD[plan.status];
  const terminalNote = TERMINAL_NOTE[plan.status];
  const payable = PAYABLE.includes(plan.status);
  const { product, customer, branch, totals } = plan;
  const paidPct = plan.principal > 0 ? Math.min(100, Math.round((totals.paid / plan.principal) * 100)) : 0;

  async function changeStatus(target: InstallmentStatus) {
    setActionError(null);
    setBusy(true);
    try {
      await updateInstallmentStatus(plan!.id, { status: target });
      setConfirmTarget(null);
      reload();
    } catch (err) {
      setConfirmTarget(null);
      // A 409 means another staff member moved it — reload shows the true state.
      if (err instanceof ApiError && err.status === 409) reload();
      setActionError(err instanceof ApiError ? err.message : 'Could not update the plan.');
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<InstallmentScheduleRow>[] = [
    {
      key: 'month',
      header: 'Month',
      render: (r) => (
        <div>
          <p className="font-semibold text-ink">{r.sequence}</p>
          <p className="text-xs text-ink-soft">{formatDate(r.dueDate)}</p>
        </div>
      ),
    },
    { key: 'due', header: 'Due', align: 'right', render: (r) => <span className="text-ink">{formatPHPExact(r.amountDue)}</span> },
    {
      key: 'paid',
      header: 'Paid',
      align: 'right',
      render: (r) => (
        <span className={r.amountPaid > 0 ? 'font-semibold text-ink' : 'text-ink-soft'}>
          {formatPHPExact(r.amountPaid)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <div className="flex flex-col gap-1">
          <InstallmentPaymentStatusBadge status={r.status} overdue={isOverdue(r)} />
          {r.paidAt && <span className="text-xs text-ink-soft">{formatDate(r.paidAt)}</span>}
        </div>
      ),
    },
    {
      key: 'method',
      header: 'Method',
      render: (r) => (
        <div className="min-w-0 text-xs text-ink-soft">
          <p>{r.method ? PAYMENT_METHOD_LABEL[r.method] : '—'}</p>
          {r.reference && <p className="truncate font-mono text-ink">{r.reference}</p>}
        </div>
      ),
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: (r) =>
        payable && r.status !== 'PAID' ? (
          <button
            onClick={() => setPayRow(r)}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 text-xs font-semibold text-brand-700 ring-1 ring-white/70 transition-colors hover:bg-white"
          >
            <Banknote size={13} /> Record
          </button>
        ) : null,
    },
  ];

  return (
    <div>
      <BackLink />
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono">{plan.reference}</span>
            <InstallmentStatusBadge status={plan.status} />
          </span>
        }
        subtitle={
          <span>
            Applied {formatDateTime(plan.createdAt)} · Updated {formatDateTime(plan.updatedAt)}
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {CANCELLABLE.includes(plan.status) && (
              <button
                onClick={() => {
                  setActionError(null);
                  setConfirmTarget('CANCELLED');
                }}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-full bg-white/70 px-4 py-2.5 text-sm font-semibold text-ink-soft ring-1 ring-white/70 transition-colors hover:bg-white hover:text-ink disabled:opacity-60"
              >
                <XCircle size={15} /> Cancel
              </button>
            )}
            {REJECTABLE.includes(plan.status) && (
              <button
                onClick={() => {
                  setActionError(null);
                  setConfirmTarget('REJECTED');
                }}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-full bg-white/70 px-4 py-2.5 text-sm font-semibold text-coral ring-1 ring-coral/20 transition-colors hover:bg-white disabled:opacity-60"
              >
                <Ban size={15} /> Reject
              </button>
            )}
            {next && (
              <button
                onClick={() => changeStatus(next)}
                disabled={busy}
                className="flex items-center gap-2 rounded-full brand-gradient px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-70 disabled:hover:scale-100"
              >
                {busy ? <Spinner size={15} tone="light" /> : <ArrowRight size={16} />}
                {FORWARD_LABEL[next] ?? `Mark as ${next}`}
              </button>
            )}
            {terminalNote && (
              <span className="rounded-full bg-white/60 px-4 py-2.5 text-sm font-semibold text-ink-soft ring-1 ring-white/70">
                {terminalNote}
              </span>
            )}
          </div>
        }
      />

      {actionError && (
        <div role="alert" className="mb-6 rounded-2xl bg-coral/10 px-4 py-3 text-sm text-coral ring-1 ring-coral/20">
          {actionError}
        </div>
      )}

      {plan.status === 'PENDING' && (
        <p className="mb-6 rounded-2xl bg-amber-500/10 px-4 py-3 text-sm text-amber-700 ring-1 ring-amber-600/20">
          Approve this plan before recording any payment.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-6">
          <section className="glass rounded-3xl p-6">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <CalendarClock size={18} className="text-brand-600" /> Payment schedule
            </h2>
            <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="text-ink-soft">
                {formatPHPExact(totals.paid)} paid of {formatPHP(plan.principal)}
              </span>
              <span className="font-semibold text-ink">{formatPHPExact(totals.remaining)} remaining</span>
            </div>
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-white/60"
              role="progressbar"
              aria-valuenow={paidPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Amount paid"
            >
              <div className="h-full brand-gradient transition-[width] duration-500" style={{ width: `${paidPct}%` }} />
            </div>
          </section>

          <DataTable
            columns={columns}
            rows={plan.schedule}
            keyOf={(r) => r.id}
            emptyMessage="This plan has no schedule rows."
          />

          <p className="text-xs text-ink-soft">
            Payments are only ever added — a recorded payment is never deleted or overwritten. Partial amounts are
            allowed; a month settles once its full amount is in.
          </p>

          <NotesCard key={plan.updatedAt} plan={plan} onSaved={reload} />
        </div>

        <aside className="flex flex-col gap-6">
          <section className="glass rounded-3xl p-6 text-sm">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <Smartphone size={18} className="text-brand-600" /> Product
            </h2>
            <p className="mt-3 font-semibold text-ink">{product.name}</p>
            {product.variantLabel && <p className="text-ink-soft">{product.variantLabel}</p>}
            <dl className="mt-4 space-y-2 border-t border-white/60 pt-4">
              <Row label="Price at apply time" value={formatPHP(product.price)} />
              <Row label="Down payment" value={formatPHP(plan.downPayment)} />
              <Row label="Financed" value={formatPHP(plan.principal)} />
              <Row label="Term" value={`${plan.termMonths} months`} />
              <Row label="Monthly" value={formatPHPExact(plan.monthlyAmount)} />
            </dl>
            <p className="mt-3 rounded-xl bg-white/60 p-3 text-xs leading-relaxed text-ink-soft">
              Price ÷ term — no interest or added fees. The price above is the snapshot taken when the customer
              applied and never changes, even if the product is repriced.
            </p>
          </section>

          <section className="glass rounded-3xl p-6 text-sm">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <User size={18} className="text-brand-600" /> Customer
            </h2>
            <div className="mt-3">
              <p className="font-semibold text-ink">{customer.name}</p>
              <p className="text-ink-soft">{customer.phone}</p>
              <p className="break-all text-ink-soft">{customer.email}</p>
            </div>
          </section>

          <section className="glass rounded-3xl p-6 text-sm">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <Store size={18} className="text-brand-600" /> Preferred branch
            </h2>
            {branch ? (
              <div className="mt-3">
                <p className="font-semibold text-ink">{branch.name}</p>
                <p className="text-ink-soft">{formatBranchLocation(branch) || 'No address on record'}</p>
              </div>
            ) : (
              <p className="mt-3 text-ink-soft">The customer didn’t pick a branch.</p>
            )}
          </section>
        </aside>
      </div>

      <RecordPaymentModal
        planId={plan.id}
        row={payRow}
        open={payRow !== null}
        onClose={() => setPayRow(null)}
        onRecorded={() => reload()}
      />

      <ConfirmDialog
        open={confirmTarget !== null}
        title={confirmTarget === 'REJECTED' ? 'Reject this application?' : 'Cancel this plan?'}
        message={
          <>
            {confirmTarget === 'REJECTED' ? 'Rejecting' : 'Cancelling'}{' '}
            <span className="font-mono font-semibold text-ink">{plan.reference}</span> closes it for good. Payments
            already recorded stay on file.
          </>
        }
        confirmLabel={confirmTarget === 'REJECTED' ? 'Reject application' : 'Cancel plan'}
        cancelLabel="Go back"
        tone="danger"
        loading={busy}
        onConfirm={() => confirmTarget && changeStatus(confirmTarget)}
        onClose={() => setConfirmTarget(null)}
      />
    </div>
  );
}
