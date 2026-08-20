import { useEffect, useState } from 'react';
import { Pencil, Plus, SlidersHorizontal } from 'lucide-react';
import { addVariant, updateVariant } from '../../../services/adminProducts';
import { ApiError } from '../../../services/http';
import { useAdminAuth } from '../../../contexts/AdminAuthContext';
import { Field, Input } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { Spinner } from '../ui/Spinner';
import { Badge } from '../ui/StatusBadge';
import { AdjustStockModal } from '../AdjustStockModal';
import type { AdjustTarget } from '../AdjustStockModal';
import { formatPHP } from '../../../utils/format';
import type { AdminVariant, VariantCreateInput, VariantUpdateInput } from '../../../types/admin';

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

interface VariantFormState {
  sku: string;
  storage: string;
  color: string;
  colorHex: string;
  price: string;
  initialStock: string;
  lowStockThreshold: string;
  imageUrl: string;
  isActive: boolean;
}

function toFormState(v: AdminVariant | null): VariantFormState {
  return {
    sku: v?.sku ?? '',
    storage: v?.storage ?? '',
    color: v?.color ?? '',
    colorHex: v?.colorHex ?? '',
    price: v ? String(v.price) : '',
    initialStock: '0',
    lowStockThreshold: v ? String(v.lowStockThreshold) : '5',
    imageUrl: v?.imageUrl ?? '',
    isActive: v ? v.isActive : true,
  };
}

/**
 * Add/edit form for a single variant. On **create** the opening stock is booked
 * through the inventory ledger server-side (`initialStock`); on **edit** stock is
 * never touched here — it moves only via "Adjust stock". Mirrors the server
 * validators (SKU/storage/color required, positive price, optional 6-hex color).
 */
function VariantFormModal({
  productId,
  editing,
  open,
  onClose,
  onSaved,
}: {
  productId: string;
  editing: AdminVariant | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = editing !== null;
  const [form, setForm] = useState<VariantFormState>(() => toFormState(editing));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(toFormState(editing));
      setError(null);
      setSubmitting(false);
    }
  }, [open, editing]);

  function patch(p: Partial<VariantFormState>) {
    setForm((prev) => ({ ...prev, ...p }));
  }

  function validate(): string | null {
    if (!form.sku.trim()) return 'SKU is required.';
    if (!form.storage.trim()) return 'Storage is required.';
    if (!form.color.trim()) return 'Color is required.';
    const price = Number(form.price);
    if (!Number.isFinite(price) || price <= 0) return 'Enter a price greater than zero.';
    if (form.colorHex.trim() && !HEX_RE.test(form.colorHex.trim())) return 'Color hex must look like #1a2b3c.';
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSubmitting(true);
    const hex = form.colorHex.trim();
    const img = form.imageUrl.trim();
    try {
      if (isEdit) {
        const input: VariantUpdateInput = {
          sku: form.sku.trim(),
          storage: form.storage.trim(),
          color: form.color.trim(),
          colorHex: hex || null,
          price: Number(form.price),
          lowStockThreshold: Number(form.lowStockThreshold) || 0,
          imageUrl: img || null,
          isActive: form.isActive,
        };
        await updateVariant(editing!.id, input);
      } else {
        const input: VariantCreateInput = {
          sku: form.sku.trim(),
          storage: form.storage.trim(),
          color: form.color.trim(),
          colorHex: hex || undefined,
          price: Number(form.price),
          initialStock: Number(form.initialStock) || 0,
          lowStockThreshold: Number(form.lowStockThreshold) || 0,
          imageUrl: img || undefined,
          isActive: form.isActive,
        };
        await addVariant(productId, input);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the variant.');
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={submitting ? () => {} : onClose}
      title={isEdit ? 'Edit variant' : 'Add variant'}
      size="lg"
      footer={
        <>
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
            form="variant-form"
            disabled={submitting}
            className="flex items-center gap-2 rounded-full brand-gradient px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-70 disabled:hover:scale-100"
          >
            {submitting && <Spinner size={15} tone="light" />}
            {isEdit ? 'Save changes' : 'Add variant'}
          </button>
        </>
      }
    >
      <form id="variant-form" onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <Field label="SKU" htmlFor="v-sku">
          <Input id="v-sku" value={form.sku} onChange={(e) => patch({ sku: e.target.value })} placeholder="IP16P-256-NT" />
        </Field>
        <Field label="Price (₱)" htmlFor="v-price">
          <Input id="v-price" type="number" min={0} step="0.01" value={form.price} onChange={(e) => patch({ price: e.target.value })} placeholder="89990" />
        </Field>
        <Field label="Storage" htmlFor="v-storage">
          <Input id="v-storage" value={form.storage} onChange={(e) => patch({ storage: e.target.value })} placeholder="256GB" />
        </Field>
        <Field label="Color" htmlFor="v-color">
          <Input id="v-color" value={form.color} onChange={(e) => patch({ color: e.target.value })} placeholder="Natural Titanium" />
        </Field>

        <Field label="Color hex" htmlFor="v-hex" hint="Optional swatch, e.g. #c9c2b8.">
          <div className="flex items-center gap-2">
            <span className="h-9 w-9 shrink-0 rounded-xl ring-1 ring-white/70" style={{ backgroundColor: HEX_RE.test(form.colorHex.trim()) ? form.colorHex.trim() : '#e5e0da' }} aria-hidden />
            <Input id="v-hex" value={form.colorHex} onChange={(e) => patch({ colorHex: e.target.value })} placeholder="#c9c2b8" />
          </div>
        </Field>
        <Field label="Low-stock threshold" htmlFor="v-low" hint="Flag as low at or below this.">
          <Input id="v-low" type="number" min={0} step={1} value={form.lowStockThreshold} onChange={(e) => patch({ lowStockThreshold: e.target.value })} />
        </Field>

        {!isEdit && (
          <Field label="Opening stock" htmlFor="v-init" hint="Booked as a RESTOCK ledger entry.">
            <Input id="v-init" type="number" min={0} step={1} value={form.initialStock} onChange={(e) => patch({ initialStock: e.target.value })} />
          </Field>
        )}

        <div className={isEdit ? 'sm:col-span-2' : ''}>
          <Field label="Image URL" htmlFor="v-img" hint="Optional per-variant image.">
            <Input id="v-img" value={form.imageUrl} onChange={(e) => patch({ imageUrl: e.target.value })} placeholder="https://placehold.co/800x800" />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <button
            type="button"
            onClick={() => patch({ isActive: !form.isActive })}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              form.isActive ? 'brand-gradient text-white shadow-sm' : 'bg-white/60 text-ink-soft ring-1 ring-white/70 hover:text-ink'
            }`}
          >
            {form.isActive ? 'Active — sellable' : 'Inactive — hidden from storefront'}
          </button>
        </div>

        {isEdit && (
          <p className="sm:col-span-2 text-xs text-ink-soft">
            Stock isn’t editable here — it moves only through the inventory ledger. Use <span className="font-semibold text-ink">Adjust stock</span> on the variant row.
          </p>
        )}

        {error && <div className="sm:col-span-2 rounded-2xl bg-coral/10 px-4 py-3 text-sm text-coral ring-1 ring-coral/20">{error}</div>}
      </form>
    </Modal>
  );
}

/** Edit-mode variants manager: list + add/edit (non-stock) + ADMIN adjust-stock. */
export function VariantsPanel({
  productId,
  productName,
  variants,
  onChanged,
}: {
  productId: string;
  productName: string;
  variants: AdminVariant[];
  onChanged: () => void;
}) {
  const { isAdmin } = useAdminAuth();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminVariant | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<AdjustTarget | null>(null);

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(v: AdminVariant) {
    setEditing(v);
    setFormOpen(true);
  }
  function openAdjust(v: AdminVariant) {
    setAdjustTarget({
      variantId: v.id,
      sku: v.sku,
      label: `${v.storage} · ${v.color}`,
      productName,
      stock: v.stock,
      lowStockThreshold: v.lowStockThreshold,
    });
  }

  return (
    <div className="glass rounded-3xl p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display font-bold">Variants</h3>
          <p className="mt-1 text-sm text-ink-soft">{variants.length} variant{variants.length === 1 ? '' : 's'}. Stock moves through the ledger only.</p>
        </div>
        <button
          onClick={openAdd}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/70 px-4 py-2 text-sm font-semibold text-brand-700 ring-1 ring-white/70 transition-colors hover:bg-white"
        >
          <Plus size={15} /> Add variant
        </button>
      </div>

      {variants.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2">
          {variants.map((v) => (
            <li
              key={v.id}
              className="flex flex-col gap-3 rounded-2xl bg-white/50 p-4 ring-1 ring-white/60 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="h-9 w-9 shrink-0 rounded-full ring-1 ring-white/70" style={{ backgroundColor: v.colorHex ?? '#e5e0da' }} aria-hidden />
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                    <span className="truncate">{v.storage} · {v.color}</span>
                    {!v.isActive && <Badge label="Inactive" tone="slate" />}
                    {v.lowStock && <Badge label="Low" tone="amber" dot />}
                  </p>
                  <p className="truncate font-mono text-xs text-ink-soft">{v.sku}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 sm:gap-6">
                <div className="text-right">
                  <p className="font-display font-bold text-ink">{formatPHP(v.price)}</p>
                  <p className="text-xs text-ink-soft">
                    <span className={v.stock <= 0 ? 'font-semibold text-coral' : 'font-semibold text-ink'}>{v.stock}</span> on hand
                    {v.reservedStock > 0 && <> · {v.reservedStock} held</>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {isAdmin && (
                    <button
                      onClick={() => openAdjust(v)}
                      title="Adjust stock"
                      className="flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 text-xs font-semibold text-brand-700 ring-1 ring-white/70 transition-colors hover:bg-white"
                    >
                      <SlidersHorizontal size={13} /> Adjust
                    </button>
                  )}
                  <button
                    onClick={() => openEdit(v)}
                    title="Edit variant"
                    aria-label="Edit variant"
                    className="grid h-8 w-8 place-items-center rounded-full bg-white/70 text-ink-soft ring-1 ring-white/70 transition-colors hover:bg-white hover:text-ink"
                  >
                    <Pencil size={14} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-4 rounded-2xl bg-white/40 py-10 text-center text-sm text-ink-soft">
          No variants yet — add the first storage/color combination.
        </div>
      )}

      <VariantFormModal
        productId={productId}
        editing={editing}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={onChanged}
      />
      <AdjustStockModal
        target={adjustTarget}
        open={adjustTarget !== null}
        onClose={() => setAdjustTarget(null)}
        onAdjusted={() => {
          setAdjustTarget(null);
          onChanged();
        }}
      />
    </div>
  );
}
