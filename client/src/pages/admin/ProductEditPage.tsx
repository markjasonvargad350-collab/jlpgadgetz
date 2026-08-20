import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Trash2 } from 'lucide-react';
import { useAdminProduct } from '../../hooks/useAdminProduct';
import { useCategories } from '../../hooks/useCategories';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { createProduct, updateProduct, deleteProduct } from '../../services/adminProducts';
import { ApiError } from '../../services/http';
import { PageHeader } from '../../components/admin/ui/PageHeader';
import { Spinner, PageLoader } from '../../components/admin/ui/Spinner';
import { ProductStatusBadge } from '../../components/admin/ui/StatusBadge';
import { ConfirmDialog } from '../../components/admin/ui/ConfirmDialog';
import { ProductFields, emptyProductFields } from '../../components/admin/product/ProductFields';
import type { ProductFieldsValue } from '../../components/admin/product/ProductFields';
import { ImagesPanel } from '../../components/admin/product/ImagesPanel';
import { VariantsPanel } from '../../components/admin/product/VariantsPanel';
import type { AdminProductDetail, ProductCreateInput, ProductUpdateInput } from '../../types/admin';

type FieldErrors = Partial<Record<keyof ProductFieldsValue, string>>;

// ── Field ⇄ payload helpers ────────────────────────────────────────────────────

function splitHighlights(raw: string): string[] {
  return raw
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

function validate(f: ProductFieldsValue): FieldErrors {
  const errors: FieldErrors = {};
  if (!f.name.trim()) errors.name = 'A product name is required.';
  if (!f.categoryId) errors.categoryId = 'Choose a category.';
  if (!f.description.trim()) errors.description = 'A description is required.';
  const price = Number(f.basePrice);
  if (!f.basePrice.trim() || !Number.isFinite(price) || price <= 0) errors.basePrice = 'Enter a base price greater than zero.';
  return errors;
}

function productToFields(p: AdminProductDetail): ProductFieldsValue {
  return {
    name: p.name,
    categoryId: p.categoryId,
    brand: p.brand,
    model: p.model ?? '',
    description: p.description,
    highlights: p.highlights.join('\n'),
    basePrice: String(p.basePrice),
    discountPct: String(p.discountPct),
    releaseYear: p.releaseYear != null ? String(p.releaseYear) : '',
    status: p.status,
    isFeatured: p.isFeatured,
    isNewArrival: p.isNewArrival,
    isBestSeller: p.isBestSeller,
    isDeal: p.isDeal,
  };
}

function toCreateInput(f: ProductFieldsValue): ProductCreateInput {
  return {
    name: f.name.trim(),
    categoryId: f.categoryId,
    brand: f.brand.trim() || undefined,
    model: f.model.trim() || undefined,
    description: f.description.trim(),
    highlights: splitHighlights(f.highlights),
    basePrice: Number(f.basePrice),
    discountPct: Number(f.discountPct) || 0,
    status: f.status,
    isFeatured: f.isFeatured,
    isNewArrival: f.isNewArrival,
    isBestSeller: f.isBestSeller,
    isDeal: f.isDeal,
    releaseYear: f.releaseYear.trim() ? Number(f.releaseYear) : undefined,
  };
}

function toUpdateInput(f: ProductFieldsValue): ProductUpdateInput {
  return {
    name: f.name.trim(),
    categoryId: f.categoryId,
    // brand is non-null on the server (defaults to "Apple") — only send a real value.
    ...(f.brand.trim() ? { brand: f.brand.trim() } : {}),
    model: f.model.trim() || null, // nullable — clears when empty
    description: f.description.trim(),
    highlights: splitHighlights(f.highlights),
    basePrice: Number(f.basePrice),
    discountPct: Number(f.discountPct) || 0,
    status: f.status,
    isFeatured: f.isFeatured,
    isNewArrival: f.isNewArrival,
    isBestSeller: f.isBestSeller,
    isDeal: f.isDeal,
    releaseYear: f.releaseYear.trim() ? Number(f.releaseYear) : null, // nullable — clears when empty
  };
}

// ── Create flow ────────────────────────────────────────────────────────────────

function NewProductForm() {
  const navigate = useNavigate();
  const { data: categories } = useCategories();
  const [form, setForm] = useState<ProductFieldsValue>(emptyProductFields);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  async function handleCreate() {
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setApiError(null);
    setSubmitting(true);
    try {
      const created = await createProduct(toCreateInput(form));
      // Straight into edit mode so images + variants can be added next.
      navigate(`/admin/products/${created.id}`, { replace: true });
    } catch (err) {
      setApiError(err instanceof ApiError ? err.message : 'Could not create the product.');
      setSubmitting(false);
    }
  }

  return (
    <div>
      <BackLink />
      <PageHeader
        title="New product"
        subtitle="Create the product, then add its images and variants."
        actions={
          <button
            onClick={handleCreate}
            disabled={submitting}
            className="flex items-center gap-2 rounded-full brand-gradient px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-70 disabled:hover:scale-100"
          >
            {submitting && <Spinner size={15} tone="light" />}
            Create product
          </button>
        }
      />

      <div className="glass rounded-3xl p-6">
        <ProductFields value={form} onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))} categories={categories} errors={errors} />
        {apiError && <div className="mt-4 rounded-2xl bg-coral/10 px-4 py-3 text-sm text-coral ring-1 ring-coral/20">{apiError}</div>}
      </div>

      <p className="mt-4 rounded-2xl bg-white/40 px-4 py-3 text-sm text-ink-soft ring-1 ring-white/60">
        Images and variants become available right after you create the product.
      </p>
    </div>
  );
}

// ── Edit flow ────────────────────────────────────────────────────────────────

function ProductEditor({ product, onChanged }: { product: AdminProductDetail; onChanged: () => void }) {
  const navigate = useNavigate();
  const { isAdmin } = useAdminAuth();
  const { data: categories } = useCategories();

  // Form state initialised once on mount (keyed by product id upstream).
  const [form, setForm] = useState<ProductFieldsValue>(() => productToFields(product));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleSave() {
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaveError(null);
    setSaved(false);
    setSaving(true);
    try {
      await updateProduct(product.id, toUpdateInput(form));
      setSaved(true);
      onChanged(); // refetch so panels + header badge reflect the new state
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleteError(null);
    setDeleting(true);
    try {
      await deleteProduct(product.id);
      navigate('/admin/products');
    } catch (err) {
      setConfirmOpen(false);
      setDeleteError(err instanceof ApiError ? err.message : 'Could not delete the product.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <BackLink />
      <PageHeader
        title={product.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <ProductStatusBadge status={product.status} />
            <span className="text-ink-soft">
              {product.categoryName} · {product.variants.length} variant{product.variants.length === 1 ? '' : 's'} · {product.totalStock} in stock
            </span>
          </span>
        }
        actions={
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-full brand-gradient px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-70 disabled:hover:scale-100"
          >
            {saving ? <Spinner size={15} tone="light" /> : saved ? <Check size={16} /> : null}
            {saved && !saving ? 'Saved' : 'Save changes'}
          </button>
        }
      />

      <div className="flex flex-col gap-6">
        <div className="glass rounded-3xl p-6">
          <h3 className="mb-4 font-display font-bold">Details</h3>
          <ProductFields
            value={form}
            onChange={(patch) => {
              setForm((prev) => ({ ...prev, ...patch }));
              setSaved(false);
            }}
            categories={categories}
            errors={errors}
          />
          {saveError && <div className="mt-4 rounded-2xl bg-coral/10 px-4 py-3 text-sm text-coral ring-1 ring-coral/20">{saveError}</div>}
        </div>

        <ImagesPanel productId={product.id} images={product.images} onChanged={onChanged} />
        <VariantsPanel productId={product.id} productName={product.name} variants={product.variants} onChanged={onChanged} />

        {isAdmin && (
          <div className="rounded-3xl bg-coral/5 p-6 ring-1 ring-coral/20">
            <h3 className="font-display font-bold text-coral">Danger zone</h3>
            <p className="mt-1 text-sm text-ink-soft">
              Permanently delete this product. This is blocked once it has sales or stock history — archive it instead.
            </p>
            {deleteError && <p className="mt-3 text-sm font-medium text-coral">{deleteError}</p>}
            <button
              onClick={() => setConfirmOpen(true)}
              className="mt-4 flex items-center gap-2 rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-coral/25 transition-transform hover:scale-[1.02] active:scale-95"
            >
              <Trash2 size={15} /> Delete product
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete product?"
        message={
          <>
            Delete <span className="font-semibold text-ink">{product.name}</span> and all its variants and images? This can’t be undone.
          </>
        }
        confirmLabel="Delete product"
        tone="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}

// ── Shared bits ────────────────────────────────────────────────────────────────

function BackLink() {
  return (
    <Link to="/admin/products" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft transition-colors hover:text-ink">
      <ArrowLeft size={16} /> Back to products
    </Link>
  );
}

/** Product create (`/new`) and edit (`/:id`) live behind the same route element. */
export function ProductEditPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === undefined;
  const { data, loading, error, reload } = useAdminProduct(isNew ? null : id);

  if (isNew) return <NewProductForm />;
  // Only block on the *initial* load. Background reloads (after a save / variant /
  // image change) keep the previous data, so the editor stays mounted — no loader
  // flash, no lost "Saved" state, no discarded in-progress edits.
  if (loading && !data) return <PageLoader label="Loading product…" />;
  if (error || !data) {
    return (
      <div>
        <BackLink />
        <div className="glass rounded-3xl p-8 text-center">
          <p className="font-display text-lg font-bold text-ink">Couldn’t load this product</p>
          <p className="mt-1 text-sm text-ink-soft">{error ?? 'It may have been deleted.'}</p>
        </div>
      </div>
    );
  }

  // key forces a fresh editor (and form initial state) when navigating between products.
  return <ProductEditor key={data.id} product={data} onChanged={reload} />;
}
