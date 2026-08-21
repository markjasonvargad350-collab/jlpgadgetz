import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Ban, Coins, Save, Smartphone, Store, User, XCircle } from 'lucide-react';
import { useAdminTradeIn } from '../../hooks/useAdminTradeIn';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { updateTradeIn } from '../../services/adminTradeIns';
import { ApiError } from '../../services/http';
import { PageHeader } from '../../components/admin/ui/PageHeader';
import { Spinner, PageLoader } from '../../components/admin/ui/Spinner';
import { TradeInStatusBadge } from '../../components/admin/ui/StatusBadge';
import { ConfirmDialog } from '../../components/admin/ui/ConfirmDialog';
import { Field, Input, Textarea } from '../../components/admin/ui/Field';
import { CONDITION_LABELS } from '../../config/condition';
import { formatPHP, formatDateTime, formatBranchLocation } from '../../utils/format';
import type { TradeInDTO, TradeInStatus } from '../../types/tradeIn';
import type { TradeInUpdateInput } from '../../types/admin';

// Client mirror of the server's ALLOWED_TRANSITIONS forward step. Declining and
// cancelling are offered separately. The server re-validates every move — this
// only decides which buttons to show.
const NEXT_FORWARD: Partial<Record<TradeInStatus, TradeInStatus>> = {
  SUBMITTED: 'REVIEWING',
  REVIEWING: 'QUOTED',
  QUOTED: 'ACCEPTED',
  ACCEPTED: 'COMPLETED',
};

const FORWARD_LABEL: Partial<Record<TradeInStatus, string>> = {
  REVIEWING: 'Start review',
  QUOTED: 'Send quote',
  ACCEPTED: 'Mark accepted',
  COMPLETED: 'Mark completed',
};

const DECLINABLE: TradeInStatus[] = ['SUBMITTED', 'REVIEWING', 'QUOTED'];
const CANCELLABLE: TradeInStatus[] = ['SUBMITTED', 'REVIEWING', 'QUOTED', 'ACCEPTED'];

const TERMINAL_NOTE: Partial<Record<TradeInStatus, string>> = {
  COMPLETED: 'Trade-in complete',
  DECLINED: 'Trade-in declined',
  CANCELLED: 'Trade-in cancelled',
};

const MAX_VALUE = 100_000_000;

function BackLink() {
  return (
    <Link
      to="/admin/trade-ins"
      className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft transition-colors hover:text-ink"
    >
      <ArrowLeft size={16} /> Back to trade-ins
    </Link>
  );
}

/**
 * Staff valuation. Both figures are typed in by a staff member after inspecting
 * the device — nothing here is calculated from the customer's description. An
 * emptied box clears the value back to "not priced yet".
 */
function ValuationCard({ tradeIn, onSaved }: { tradeIn: TradeInDTO; onSaved: () => void }) {
  const [quoted, setQuoted] = useState(tradeIn.quotedValue != null ? String(tradeIn.quotedValue) : '');
  const [final, setFinal] = useState(tradeIn.finalValue != null ? String(tradeIn.finalValue) : '');
  const [notes, setNotes] = useState(tradeIn.staffNotes ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function amountError(raw: string, label: string): string | null {
    if (!raw.trim()) return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return `${label} must be a number.`;
    if (n < 0) return `${label} cannot be negative.`;
    if (n > MAX_VALUE) return `${label} is unrealistically high.`;
    return null;
  }

  const quotedErr = amountError(quoted, 'Quoted value');
  const finalErr = amountError(final, 'Final value');

  async function save() {
    if (quotedErr || finalErr || saving) return;
    setErr(null);
    setSaved(false);
    setSaving(true);
    const patch: TradeInUpdateInput = {
      quotedValue: quoted.trim() ? Number(quoted) : null,
      finalValue: final.trim() ? Number(final) : null,
      staffNotes: notes.trim() || null,
    };
    try {
      await updateTradeIn(tradeIn.id, patch);
      setSaved(true);
      onSaved();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not save the valuation.');
    } finally {
      setSaving(false);
    }
  }

  const touched = () => {
    setSaved(false);
    setErr(null);
  };

  return (
    <section className="glass rounded-3xl p-6">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold">
        <Coins size={18} className="text-brand-600" /> Staff valuation
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        You decide what this device is worth. Inspect it first, then record your offer here.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field
          label="Quoted value (₱)"
          htmlFor="ti-quoted"
          error={quotedErr ?? undefined}
          hint="Your offer to the customer."
        >
          <Input
            id="ti-quoted"
            inputMode="decimal"
            value={quoted}
            onChange={(e) => {
              setQuoted(e.target.value);
              touched();
            }}
            placeholder="Not priced yet"
          />
        </Field>
        <Field
          label="Final value (₱)"
          htmlFor="ti-final"
          error={finalErr ?? undefined}
          hint="What you actually settled on."
        >
          <Input
            id="ti-final"
            inputMode="decimal"
            value={final}
            onChange={(e) => {
              setFinal(e.target.value);
              touched();
            }}
            placeholder="Not settled yet"
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Internal notes" htmlFor="ti-notes" hint="Only visible to your team.">
            <Textarea
              id="ti-notes"
              rows={4}
              maxLength={2000}
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                touched();
              }}
              placeholder="Screen has a hairline scratch, battery at 87%, no box…"
            />
          </Field>
        </div>
      </div>

      {err && (
        <div role="alert" className="mt-4 rounded-2xl bg-coral/10 px-4 py-3 text-sm text-coral ring-1 ring-coral/20">
          {err}
        </div>
      )}

      <button
        onClick={save}
        disabled={saving || Boolean(quotedErr) || Boolean(finalErr)}
        className="mt-4 flex items-center gap-2 rounded-full brand-gradient px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition-transform hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
      >
        {saving ? <Spinner size={15} tone="light" /> : <Save size={15} />}
        {saved && !saving ? 'Saved' : 'Save valuation'}
      </button>
    </section>
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

export function TradeInDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: tradeIn, loading, error, reload } = useAdminTradeIn(id ?? null);

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<TradeInStatus | null>(null);

  useDocumentTitle(tradeIn ? `Trade-in ${tradeIn.reference}` : 'Trade-in');

  if (loading && !tradeIn) return <PageLoader label="Loading trade-in…" />;
  if (error || !tradeIn) {
    return (
      <div>
        <BackLink />
        <div className="glass rounded-3xl p-8 text-center">
          <p className="font-display text-lg font-bold text-ink">Couldn’t load this trade-in</p>
          <p className="mt-1 text-sm text-ink-soft">{error ?? 'It may not exist.'}</p>
        </div>
      </div>
    );
  }

  const next = NEXT_FORWARD[tradeIn.status];
  const terminalNote = TERMINAL_NOTE[tradeIn.status];
  const { device, customer, branch } = tradeIn;

  async function changeStatus(target: TradeInStatus) {
    setActionError(null);
    setBusy(true);
    try {
      await updateTradeIn(tradeIn!.id, { status: target });
      setConfirmTarget(null);
      reload();
    } catch (err) {
      setConfirmTarget(null);
      // A 409 means another staff member moved it — reload shows the true state.
      if (err instanceof ApiError && err.status === 409) reload();
      setActionError(err instanceof ApiError ? err.message : 'Could not update the trade-in.');
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
            <span className="font-mono">{tradeIn.reference}</span>
            <TradeInStatusBadge status={tradeIn.status} />
          </span>
        }
        subtitle={
          <span>
            Submitted {formatDateTime(tradeIn.createdAt)} · Updated {formatDateTime(tradeIn.updatedAt)}
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {CANCELLABLE.includes(tradeIn.status) && (
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
            {DECLINABLE.includes(tradeIn.status) && (
              <button
                onClick={() => {
                  setActionError(null);
                  setConfirmTarget('DECLINED');
                }}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-full bg-white/70 px-4 py-2.5 text-sm font-semibold text-coral ring-1 ring-coral/20 transition-colors hover:bg-white disabled:opacity-60"
              >
                <Ban size={15} /> Decline
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

      {next === 'QUOTED' && tradeIn.quotedValue == null && (
        <p className="mb-6 rounded-2xl bg-amber-500/10 px-4 py-3 text-sm text-amber-700 ring-1 ring-amber-600/20">
          Enter a quoted value below before you send the quote, so the customer has a figure to accept.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-6">
          <section className="glass rounded-3xl p-6">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <Smartphone size={18} className="text-brand-600" /> Device
            </h2>
            <p className="mt-3 font-display text-xl font-extrabold text-ink">
              {device.brand} {device.model}
            </p>
            <dl className="mt-4 space-y-2 border-t border-white/60 pt-4 text-sm">
              <Row label="Storage" value={device.storage ?? '—'} />
              <Row label="Colour" value={device.color ?? '—'} />
              <Row label="Condition (as reported)" value={CONDITION_LABELS[device.condition] ?? device.condition} />
              <Row label="Battery health" value={device.batteryHealth != null ? `${device.batteryHealth}%` : '—'} />
              <Row label="IMEI" value={device.imei ? <span className="font-mono">{device.imei}</span> : '—'} />
              <Row label="Original box" value={device.hasBox ? 'Yes' : 'No'} />
              <Row label="Charger" value={device.hasCharger ? 'Yes' : 'No'} />
            </dl>
            {device.issues && (
              <div className="mt-4 rounded-2xl bg-white/60 p-3 text-sm">
                <p className="text-xs font-semibold text-ink-soft">Issues reported by the customer</p>
                <p className="mt-1 whitespace-pre-line text-ink">{device.issues}</p>
              </div>
            )}
            {device.photos.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-ink-soft">Photos ({device.photos.length})</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {device.photos.map((url, i) => (
                    <a
                      key={`${url}-${i}`}
                      href={url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="block h-20 w-20 overflow-hidden rounded-2xl bg-white/60 ring-1 ring-white/70 transition-transform hover:scale-105"
                    >
                      <img src={url} alt={`Device photo ${i + 1}`} loading="lazy" className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
              </div>
            )}
            <p className="mt-4 text-xs text-ink-soft">
              These details are self-reported by the customer. Always verify on inspection.
            </p>
          </section>

          <ValuationCard key={tradeIn.updatedAt} tradeIn={tradeIn} onSaved={reload} />
        </div>

        <aside className="flex flex-col gap-6">
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

          <section className="glass rounded-3xl p-6 text-sm">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <Coins size={18} className="text-brand-600" /> Offer
            </h2>
            <dl className="mt-3 space-y-2">
              <Row label="Quoted" value={tradeIn.quotedValue != null ? formatPHP(tradeIn.quotedValue) : 'Not priced yet'} />
              <Row label="Final" value={tradeIn.finalValue != null ? formatPHP(tradeIn.finalValue) : 'Not settled yet'} />
            </dl>
          </section>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmTarget !== null}
        title={confirmTarget === 'DECLINED' ? 'Decline this trade-in?' : 'Cancel this trade-in?'}
        message={
          <>
            {confirmTarget === 'DECLINED' ? 'Declining' : 'Cancelling'}{' '}
            <span className="font-mono font-semibold text-ink">{tradeIn.reference}</span> closes the request for good.
            Your valuation and notes are kept on record.
          </>
        }
        confirmLabel={confirmTarget === 'DECLINED' ? 'Decline trade-in' : 'Cancel trade-in'}
        cancelLabel="Go back"
        tone="danger"
        loading={busy}
        onConfirm={() => confirmTarget && changeStatus(confirmTarget)}
        onClose={() => setConfirmTarget(null)}
      />
    </div>
  );
}
