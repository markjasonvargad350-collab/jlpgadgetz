import { useEffect, useState } from 'react';
import { PackagePlus, Pencil } from 'lucide-react';
import { adjustStock } from '../../services/adminInventory';
import { ApiError } from '../../services/http';
import { Field, Input, Select, Textarea } from './ui/Field';
import { Modal } from './ui/Modal';
import { Spinner } from './ui/Spinner';
import type { AdjustInput, AdjustResult } from '../../types/admin';

/** Normalized handle for whichever variant is being adjusted. */
export interface AdjustTarget {
  variantId: string;
  sku: string;
  label: string; // e.g. "256GB · Natural Titanium"
  productName: string;
  stock: number;
  lowStockThreshold: number;
}

type DeltaType = 'RESTOCK' | 'RETURN' | 'CANCELLATION' | 'ADJUSTMENT';

const DELTA_TYPES: { value: DeltaType; label: string; addOnly: boolean }[] = [
  { value: 'RESTOCK', label: 'Restock — new stock arrived', addOnly: true },
  { value: 'RETURN', label: 'Customer return', addOnly: true },
  { value: 'CANCELLATION', label: 'Cancelled order', addOnly: true },
  { value: 'ADJUSTMENT', label: 'Correction (count / audit) — may be ±', addOnly: false },
];

/**
 * Manual stock-movement modal (ADMIN only). Two modes mirror the server's
 * discriminated union: a signed **delta** of a chosen ledger type, or an
 * absolute **set** value (recorded as an ADJUSTMENT with a compare-and-set
 * guard). All authoritative validation lives server-side; we surface its 409/422.
 */
export function AdjustStockModal({
  target,
  open,
  onClose,
  onAdjusted,
}: {
  target: AdjustTarget | null;
  open: boolean;
  onClose: () => void;
  onAdjusted: (result: AdjustResult) => void;
}) {
  const [mode, setMode] = useState<'delta' | 'set'>('delta');
  const [type, setType] = useState<DeltaType>('RESTOCK');
  const [qty, setQty] = useState('');
  const [newStock, setNewStock] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the form whenever a new target is opened.
  useEffect(() => {
    if (open) {
      setMode('delta');
      setType('RESTOCK');
      setQty('');
      setNewStock('');
      setReason('');
      setError(null);
      setSubmitting(false);
    }
  }, [open, target?.variantId]);

  if (!target) return null;

  const addOnly = DELTA_TYPES.find((t) => t.value === type)?.addOnly ?? false;
  const qtyNum = Number.parseInt(qty, 10);
  const newNum = Number.parseInt(newStock, 10);
  const preview =
    mode === 'delta'
      ? Number.isFinite(qtyNum)
        ? target.stock + qtyNum
        : null
      : Number.isFinite(newNum)
        ? newNum
        : null;

  function validate(): AdjustInput | string {
    if (mode === 'delta') {
      if (!Number.isFinite(qtyNum) || qtyNum === 0) return 'Enter a non-zero quantity.';
      if (addOnly && qtyNum < 0) return 'This movement can only add stock.';
      return {
        mode: 'delta',
        variantId: target!.variantId,
        type,
        quantity: addOnly ? Math.abs(qtyNum) : qtyNum,
        reason: reason.trim() || undefined,
      };
    }
    if (!Number.isFinite(newNum) || newNum < 0) return 'Enter a stock count of 0 or more.';
    if (newNum === target!.stock) return 'Stock is already at that level.';
    return { mode: 'set', variantId: target!.variantId, newStock: newNum, reason: reason.trim() || undefined };
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
      const result = await adjustStock(input);
      onAdjusted(result);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Adjustment failed. Please try again.');
      setSubmitting(false);
    }
  }

  const tabClass = (active: boolean) =>
    `flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-colors ${
      active ? 'bg-white/80 text-brand-700 shadow-sm' : 'text-ink-soft hover:text-ink'
    }`;

  return (
    <Modal open={open} onClose={submitting ? () => {} : onClose} title="Adjust stock" size="md">
      <div className="mb-4 rounded-2xl bg-white/50 px-4 py-3">
        <p className="text-sm font-semibold text-ink">{target.productName}</p>
        <p className="text-xs text-ink-soft">
          {target.label} · SKU {target.sku} · on hand{' '}
          <span className="font-semibold text-ink">{target.stock}</span>
        </p>
      </div>

      {/* mode tabs */}
      <div className="mb-4 flex gap-1 rounded-2xl bg-white/40 p-1">
        <button type="button" onClick={() => setMode('delta')} className={tabClass(mode === 'delta')}>
          <PackagePlus size={16} /> Adjust by amount
        </button>
        <button type="button" onClick={() => setMode('set')} className={tabClass(mode === 'set')}>
          <Pencil size={16} /> Set to value
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {mode === 'delta' ? (
          <>
            <Field label="Movement type" htmlFor="adj-type">
              <Select id="adj-type" value={type} onChange={(e) => setType(e.target.value as DeltaType)}>
                {DELTA_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={addOnly ? 'Quantity to add' : 'Change (±)'}
              htmlFor="adj-qty"
              hint={addOnly ? 'Adds to current stock.' : 'Use a negative number to remove stock.'}
            >
              <Input
                id="adj-qty"
                type="number"
                inputMode="numeric"
                step={1}
                min={addOnly ? 1 : undefined}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder={addOnly ? 'e.g. 20' : 'e.g. -3'}
              />
            </Field>
          </>
        ) : (
          <Field label="New stock count" htmlFor="adj-new" hint="Recorded as a correction with the exact delta.">
            <Input
              id="adj-new"
              type="number"
              inputMode="numeric"
              step={1}
              min={0}
              value={newStock}
              onChange={(e) => setNewStock(e.target.value)}
              placeholder="e.g. 50"
            />
          </Field>
        )}

        <Field label="Reason" htmlFor="adj-reason" hint="Optional — stored in the inventory ledger.">
          <Textarea
            id="adj-reason"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Supplier delivery #4821"
          />
        </Field>

        {preview !== null && (
          <p className="text-sm text-ink-soft">
            New on-hand stock:{' '}
            <span className={`font-display text-lg font-bold ${preview < 0 ? 'text-coral' : 'text-ink'}`}>
              {preview}
            </span>
            {preview < 0 && <span className="ml-2 text-xs text-coral">Can't go below zero — will be rejected.</span>}
          </p>
        )}

        {error && (
          <div role="alert" className="rounded-2xl bg-coral/10 px-4 py-3 text-sm text-coral ring-1 ring-coral/20">{error}</div>
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
            {submitting && <Spinner size={15} tone="light" />}
            Apply adjustment
          </button>
        </div>
      </form>
    </Modal>
  );
}
