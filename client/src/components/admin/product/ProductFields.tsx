import { Field, Input, Select, Textarea } from '../ui/Field';
import type { Category } from '../../../types/api';
import type { ProductStatus } from '../../../types/admin';

/** Controlled form state for a product's core attributes. Numeric fields are
 *  kept as strings for input control and parsed by the caller on submit. */
export interface ProductFieldsValue {
  name: string;
  categoryId: string;
  brand: string;
  model: string;
  description: string;
  highlights: string; // one per line in the textarea
  basePrice: string;
  discountPct: string;
  releaseYear: string;
  status: ProductStatus;
  /** Lets customers apply to pay this product monthly (price ÷ term). */
  installmentAvailable: boolean;
  /** Smallest accepted down payment as a % of the price (0–90). */
  installmentMinDownPct: string;
  isFeatured: boolean;
  isNewArrival: boolean;
  isBestSeller: boolean;
  isDeal: boolean;
  /** Marks the whole listing as second-hand. Per-unit state is variant condition. */
  isPreOwned: boolean;
}

export const emptyProductFields: ProductFieldsValue = {
  name: '',
  categoryId: '',
  brand: 'Apple',
  model: '',
  description: '',
  highlights: '',
  basePrice: '',
  discountPct: '0',
  releaseYear: '',
  status: 'DRAFT',
  installmentAvailable: false,
  installmentMinDownPct: '0',
  isFeatured: false,
  isNewArrival: false,
  isBestSeller: false,
  isDeal: false,
  isPreOwned: false,
};

const FLAGS: { key: keyof ProductFieldsValue; label: string }[] = [
  { key: 'isFeatured', label: 'Featured' },
  { key: 'isNewArrival', label: 'New arrival' },
  { key: 'isBestSeller', label: 'Best seller' },
  { key: 'isDeal', label: 'On deal' },
  { key: 'isPreOwned', label: 'Pre-loved / pre-owned' },
];

/** The core product attributes form (shared by create + edit). */
export function ProductFields({
  value,
  onChange,
  categories,
  errors = {},
}: {
  value: ProductFieldsValue;
  onChange: (patch: Partial<ProductFieldsValue>) => void;
  categories: Category[];
  errors?: Partial<Record<keyof ProductFieldsValue, string>>;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field label="Product name" htmlFor="p-name" error={errors.name}>
          <Input id="p-name" value={value.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="iPhone 16 Pro" />
        </Field>
      </div>

      <Field label="Category" htmlFor="p-cat" error={errors.categoryId}>
        <Select id="p-cat" value={value.categoryId} onChange={(e) => onChange({ categoryId: e.target.value })}>
          <option value="" disabled>
            Select a category…
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Status" htmlFor="p-status">
        <Select id="p-status" value={value.status} onChange={(e) => onChange({ status: e.target.value as ProductStatus })}>
          <option value="DRAFT">Draft — hidden from storefront</option>
          <option value="ACTIVE">Active — published</option>
          <option value="ARCHIVED">Archived — hidden, kept for history</option>
        </Select>
      </Field>

      <Field label="Brand" htmlFor="p-brand">
        <Input id="p-brand" value={value.brand} onChange={(e) => onChange({ brand: e.target.value })} placeholder="Apple" />
      </Field>

      <Field label="Model" htmlFor="p-model" hint="Optional, e.g. “iPhone 16 Pro”.">
        <Input id="p-model" value={value.model} onChange={(e) => onChange({ model: e.target.value })} placeholder="iPhone 16 Pro" />
      </Field>

      <Field label="Base price (₱)" htmlFor="p-price" error={errors.basePrice} hint="“From” price; variants may override.">
        <Input id="p-price" type="number" min={0} step="0.01" value={value.basePrice} onChange={(e) => onChange({ basePrice: e.target.value })} placeholder="89990" />
      </Field>

      <Field label="Discount %" htmlFor="p-disc" hint="0–100, storefront strike-through.">
        <Input id="p-disc" type="number" min={0} max={100} step={1} value={value.discountPct} onChange={(e) => onChange({ discountPct: e.target.value })} />
      </Field>

      <Field label="Release year" htmlFor="p-year" hint="Optional.">
        <Input id="p-year" type="number" min={2000} max={2100} step={1} value={value.releaseYear} onChange={(e) => onChange({ releaseYear: e.target.value })} placeholder="2026" />
      </Field>

      <div className="sm:col-span-2">
        <Field label="Description" htmlFor="p-desc" error={errors.description}>
          <Textarea id="p-desc" rows={4} value={value.description} onChange={(e) => onChange({ description: e.target.value })} placeholder="Long-form marketing copy…" />
        </Field>
      </div>

      <div className="sm:col-span-2">
        <Field label="Highlights" htmlFor="p-high" hint="One bullet per line.">
          <Textarea id="p-high" rows={3} value={value.highlights} onChange={(e) => onChange({ highlights: e.target.value })} placeholder={'A18 Pro chip\n48MP Fusion camera\nTitanium design'} />
        </Field>
      </div>

      <div className="sm:col-span-2">
        <span className="mb-1.5 block text-sm font-semibold text-ink">Flags</span>
        <div className="flex flex-wrap gap-2">
          {FLAGS.map((f) => {
            const active = value[f.key] as boolean;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => onChange({ [f.key]: !active } as Partial<ProductFieldsValue>)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  active ? 'brand-gradient text-white shadow-sm' : 'bg-white/60 text-ink-soft ring-1 ring-white/70 hover:text-ink'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-ink-soft">
          “Pre-loved / pre-owned” marks the whole listing as second-hand — it shows a badge on the storefront and puts
          the product in the Pre-loved section. The condition of each individual unit (brand new, open box, pre-owned,
          refurbished) is still set per variant below.
        </p>
      </div>

      {/* Installment opt-in. Monthly = price ÷ term, computed server-side — there
          is no interest or fee to configure here. */}
      <div className="rounded-2xl bg-white/50 p-4 sm:col-span-2">
        <span className="block text-sm font-semibold text-ink">Installment</span>
        <p className="mt-1 text-xs text-ink-soft">
          Let customers apply to pay this product monthly. The monthly amount is simply the price divided by the term
          they pick (3, 6, 9 or 12 months) — no interest or extra fees are added.
        </p>
        <button
          type="button"
          onClick={() => onChange({ installmentAvailable: !value.installmentAvailable })}
          aria-pressed={value.installmentAvailable}
          className={`mt-3 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
            value.installmentAvailable
              ? 'brand-gradient text-white shadow-sm'
              : 'bg-white/60 text-ink-soft ring-1 ring-white/70 hover:text-ink'
          }`}
        >
          {value.installmentAvailable ? 'Installment allowed' : 'Installment off'}
        </button>

        {value.installmentAvailable && (
          <div className="mt-4 sm:max-w-xs">
            <Field
              label="Minimum down payment %"
              htmlFor="p-mindown"
              error={errors.installmentMinDownPct}
              hint="0–90. Use 0 to accept no down payment."
            >
              <Input
                id="p-mindown"
                type="number"
                min={0}
                max={90}
                step={1}
                value={value.installmentMinDownPct}
                onChange={(e) => onChange({ installmentMinDownPct: e.target.value })}
              />
            </Field>
          </div>
        )}
      </div>
    </div>
  );
}
