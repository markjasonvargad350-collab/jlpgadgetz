import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Trash2 } from 'lucide-react';
import { useAdminBranch } from '../../hooks/useAdminBranch';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { createBranch, updateBranch, deleteBranch } from '../../services/adminBranches';
import { ApiError } from '../../services/http';
import { PageHeader } from '../../components/admin/ui/PageHeader';
import { Spinner, PageLoader } from '../../components/admin/ui/Spinner';
import { Badge } from '../../components/admin/ui/StatusBadge';
import { ConfirmDialog } from '../../components/admin/ui/ConfirmDialog';
import { Field, Input } from '../../components/admin/ui/Field';
import type { AdminBranch, BranchCreateInput, BranchUpdateInput } from '../../types/admin';

/** Every numeric is held as a string so a half-typed value never becomes NaN. */
interface BranchFieldsValue {
  name: string;
  slug: string;
  city: string;
  province: string;
  addressLine: string;
  phone: string;
  email: string;
  hours: string;
  lat: string;
  lng: string;
  position: string;
  isActive: boolean;
  isDefault: boolean;
}

const EMPTY_BRANCH: BranchFieldsValue = {
  name: '',
  slug: '',
  city: '',
  province: '',
  addressLine: '',
  phone: '',
  email: '',
  hours: '',
  lat: '',
  lng: '',
  position: '0',
  isActive: true,
  isDefault: false,
};

type FieldErrors = Partial<Record<keyof BranchFieldsValue, string>>;

// ── Field ⇄ payload helpers ────────────────────────────────────────────────────

// Mirrors the server's Zod rules for fast feedback; the server still re-validates
// everything and remains the source of truth.
function validate(f: BranchFieldsValue): FieldErrors {
  const errors: FieldErrors = {};
  if (!f.name.trim()) errors.name = 'A branch name is required.';
  else if (f.name.trim().length > 120) errors.name = 'Name is too long (max 120).';

  const email = f.email.trim();
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.email = 'Enter a valid email address.';

  const pos = Number(f.position);
  if (f.position.trim() && (!Number.isInteger(pos) || pos < 0 || pos > 1000)) {
    errors.position = 'Use a whole number from 0 to 1000.';
  }

  const hasLat = f.lat.trim() !== '';
  const hasLng = f.lng.trim() !== '';
  if (hasLat) {
    const lat = Number(f.lat);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) errors.lat = 'Latitude must be between −90 and 90.';
  }
  if (hasLng) {
    const lng = Number(f.lng);
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) errors.lng = 'Longitude must be between −180 and 180.';
  }
  // A lone coordinate can't place a pin, so ask for the pair or neither.
  if (hasLat !== hasLng) {
    const missing = hasLat ? 'lng' : 'lat';
    errors[missing] = 'Enter both latitude and longitude, or leave both blank.';
  }
  return errors;
}

function branchToFields(b: AdminBranch): BranchFieldsValue {
  return {
    name: b.name,
    slug: b.slug,
    city: b.city ?? '',
    province: b.province ?? '',
    addressLine: b.addressLine ?? '',
    phone: b.phone ?? '',
    email: b.email ?? '',
    hours: b.hours ?? '',
    lat: b.lat != null ? String(b.lat) : '',
    lng: b.lng != null ? String(b.lng) : '',
    position: String(b.position),
    isActive: b.isActive,
    isDefault: b.isDefault,
  };
}

function toCreateInput(f: BranchFieldsValue): BranchCreateInput {
  const trimmed = (v: string) => v.trim() || undefined;
  return {
    name: f.name.trim(),
    // Left out on create so the server slugifies the name for us.
    ...(f.slug.trim() ? { slug: f.slug.trim() } : {}),
    city: trimmed(f.city),
    province: trimmed(f.province),
    addressLine: trimmed(f.addressLine),
    phone: trimmed(f.phone),
    email: trimmed(f.email),
    hours: trimmed(f.hours),
    ...(f.lat.trim() ? { lat: Number(f.lat) } : {}),
    ...(f.lng.trim() ? { lng: Number(f.lng) } : {}),
    position: f.position.trim() ? Number(f.position) : 0,
    isActive: f.isActive,
    isDefault: f.isDefault,
  };
}

function toUpdateInput(f: BranchFieldsValue): BranchUpdateInput {
  // Nullable fields clear when the input is emptied; slug is non-nullable, so an
  // empty box just means "leave it alone".
  const orNull = (v: string) => v.trim() || null;
  return {
    name: f.name.trim(),
    ...(f.slug.trim() ? { slug: f.slug.trim() } : {}),
    city: orNull(f.city),
    province: orNull(f.province),
    addressLine: orNull(f.addressLine),
    phone: orNull(f.phone),
    email: orNull(f.email),
    hours: orNull(f.hours),
    lat: f.lat.trim() ? Number(f.lat) : null,
    lng: f.lng.trim() ? Number(f.lng) : null,
    position: f.position.trim() ? Number(f.position) : 0,
    isActive: f.isActive,
    isDefault: f.isDefault,
  };
}

// ── Shared form body ───────────────────────────────────────────────────────────

function BranchFields({
  value: f,
  onChange,
  errors,
}: {
  value: BranchFieldsValue;
  onChange: (patch: Partial<BranchFieldsValue>) => void;
  errors: FieldErrors;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Branch name" htmlFor="br-name" error={errors.name}>
        <Input
          id="br-name"
          value={f.name}
          onChange={(e) => onChange({ name: e.target.value })}
          maxLength={120}
          placeholder="JLP Gadgetz Center — Passi"
        />
      </Field>
      <Field
        label="URL slug"
        htmlFor="br-slug"
        error={errors.slug}
        hint="Leave blank to generate one from the name."
      >
        <Input
          id="br-slug"
          value={f.slug}
          onChange={(e) => onChange({ slug: e.target.value })}
          maxLength={120}
          placeholder="passi-iloilo"
        />
      </Field>

      <Field label="City / municipality" htmlFor="br-city" error={errors.city}>
        <Input
          id="br-city"
          value={f.city}
          onChange={(e) => onChange({ city: e.target.value })}
          maxLength={120}
          placeholder="Passi City"
        />
      </Field>
      <Field label="Province" htmlFor="br-province" error={errors.province}>
        <Input
          id="br-province"
          value={f.province}
          onChange={(e) => onChange({ province: e.target.value })}
          maxLength={120}
          placeholder="Iloilo"
        />
      </Field>

      <Field
        label="Street address"
        htmlFor="br-address"
        error={errors.addressLine}
        hint="Leave blank if this branch has no street address to publish — the city and province are shown instead."
      >
        <Input
          id="br-address"
          value={f.addressLine}
          onChange={(e) => onChange({ addressLine: e.target.value })}
          maxLength={240}
          placeholder="Dorillo Street"
        />
      </Field>
      <Field label="Opening hours" htmlFor="br-hours" error={errors.hours}>
        <Input
          id="br-hours"
          value={f.hours}
          onChange={(e) => onChange({ hours: e.target.value })}
          maxLength={240}
          placeholder="Mon–Sat, 9:00 AM – 7:00 PM"
        />
      </Field>

      <Field label="Phone" htmlFor="br-phone" error={errors.phone}>
        <Input
          id="br-phone"
          value={f.phone}
          onChange={(e) => onChange({ phone: e.target.value })}
          maxLength={40}
          placeholder="0930 119 7407"
        />
      </Field>
      <Field label="Email" htmlFor="br-email" error={errors.email}>
        <Input
          id="br-email"
          type="email"
          value={f.email}
          onChange={(e) => onChange({ email: e.target.value })}
          maxLength={254}
          placeholder="jlpgadgetzcenter@gmail.com"
        />
      </Field>

      <Field
        label="Latitude"
        htmlFor="br-lat"
        error={errors.lat}
        hint="Optional map pin. Copy the pair from Google Maps."
      >
        <Input
          id="br-lat"
          value={f.lat}
          onChange={(e) => onChange({ lat: e.target.value })}
          inputMode="decimal"
          placeholder="11.1077"
        />
      </Field>
      <Field label="Longitude" htmlFor="br-lng" error={errors.lng}>
        <Input
          id="br-lng"
          value={f.lng}
          onChange={(e) => onChange({ lng: e.target.value })}
          inputMode="decimal"
          placeholder="122.6414"
        />
      </Field>

      <Field
        label="Display order"
        htmlFor="br-position"
        error={errors.position}
        hint="Lower numbers appear first in customer pickers."
      >
        <Input
          id="br-position"
          type="number"
          inputMode="numeric"
          step={1}
          min={0}
          max={1000}
          value={f.position}
          onChange={(e) => onChange({ position: e.target.value })}
        />
      </Field>

      <div className="flex flex-wrap items-end gap-2 sm:col-span-2">
        <Toggle
          label="Visible to customers"
          active={f.isActive}
          onClick={() => onChange({ isActive: !f.isActive })}
        />
        <Toggle
          label="Main branch"
          active={f.isDefault}
          onClick={() => onChange({ isDefault: !f.isDefault })}
        />
      </div>
      <p className="text-xs text-ink-soft sm:col-span-2">
        Only one branch can be the main one — marking this branch main clears the flag on the others.
      </p>
    </div>
  );
}

function Toggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
        active ? 'brand-gradient text-white shadow-sm' : 'bg-white/60 text-ink-soft ring-1 ring-white/70 hover:text-ink'
      }`}
    >
      {label}
    </button>
  );
}

// ── Create flow ────────────────────────────────────────────────────────────────

function NewBranchForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState<BranchFieldsValue>(EMPTY_BRANCH);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  useDocumentTitle('New branch');

  async function handleCreate() {
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setApiError(null);
    setSubmitting(true);
    try {
      const created = await createBranch(toCreateInput(form));
      navigate(`/admin/branches/${created.id}`, { replace: true });
    } catch (err) {
      setApiError(err instanceof ApiError ? err.message : 'Could not create the branch.');
      setSubmitting(false);
    }
  }

  return (
    <div>
      <BackLink />
      <PageHeader
        title="New branch"
        subtitle="Customers pick a branch for convenience — the catalog and stock stay shared."
        actions={
          <button
            onClick={handleCreate}
            disabled={submitting}
            className="flex items-center gap-2 rounded-full brand-gradient px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-70 disabled:hover:scale-100"
          >
            {submitting && <Spinner size={15} tone="light" />}
            Create branch
          </button>
        }
      />

      <div className="glass rounded-3xl p-6">
        <BranchFields
          value={form}
          onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
          errors={errors}
        />
        {apiError && (
          <div role="alert" className="mt-4 rounded-2xl bg-coral/10 px-4 py-3 text-sm text-coral ring-1 ring-coral/20">
            {apiError}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Edit flow ────────────────────────────────────────────────────────────────

function BranchEditor({ branch, onChanged }: { branch: AdminBranch; onChanged: () => void }) {
  const navigate = useNavigate();
  const { isAdmin } = useAdminAuth();

  const [form, setForm] = useState<BranchFieldsValue>(() => branchToFields(branch));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  useDocumentTitle(branch.name);

  async function handleSave() {
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaveError(null);
    setSaved(false);
    setSaving(true);
    try {
      await updateBranch(branch.id, toUpdateInput(form));
      setSaved(true);
      onChanged();
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
      await deleteBranch(branch.id);
      navigate('/admin/branches');
    } catch (err) {
      setConfirmOpen(false);
      setDeleteError(err instanceof ApiError ? err.message : 'Could not delete the branch.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <BackLink />
      <PageHeader
        title={branch.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {branch.isActive ? <Badge label="Active" tone="emerald" dot /> : <Badge label="Hidden" tone="slate" dot />}
            {branch.isDefault && <Badge label="Main branch" tone="brand" />}
            <span className="text-ink-soft">
              {branch.orderCount} order{branch.orderCount === 1 ? '' : 's'} · {branch.tradeInCount} trade-in
              {branch.tradeInCount === 1 ? '' : 's'} · {branch.installmentCount} plan
              {branch.installmentCount === 1 ? '' : 's'}
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
          <BranchFields
            value={form}
            onChange={(patch) => {
              setForm((prev) => ({ ...prev, ...patch }));
              setSaved(false);
            }}
            errors={errors}
          />
          {saveError && (
            <div role="alert" className="mt-4 rounded-2xl bg-coral/10 px-4 py-3 text-sm text-coral ring-1 ring-coral/20">
              {saveError}
            </div>
          )}
        </div>

        {isAdmin && (
          <div className="rounded-3xl bg-coral/5 p-6 ring-1 ring-coral/20">
            <h3 className="font-display font-bold text-coral">Danger zone</h3>
            <p className="mt-1 text-sm text-ink-soft">
              {branch.canDelete
                ? 'Permanently delete this branch. Nothing references it yet, so this is safe.'
                : 'This branch already has orders, trade-ins or installment plans, so it can’t be deleted. Untick “Visible to customers” above to hide it instead — the history stays intact.'}
            </p>
            {deleteError && <p role="alert" className="mt-3 text-sm font-medium text-coral">{deleteError}</p>}
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={!branch.canDelete}
              className="mt-4 flex items-center gap-2 rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-coral/25 transition-transform hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
            >
              <Trash2 size={15} /> Delete branch
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete branch?"
        message={
          <>
            Delete <span className="font-semibold text-ink">{branch.name}</span>? Customers will no longer be able to
            pick it. This can’t be undone.
          </>
        }
        confirmLabel="Delete branch"
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
    <Link
      to="/admin/branches"
      className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft transition-colors hover:text-ink"
    >
      <ArrowLeft size={16} /> Back to branches
    </Link>
  );
}

/** Branch create (`/new`) and edit (`/:id`) share one route element. */
export function BranchEditPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === undefined;
  const { data, loading, error, reload } = useAdminBranch(isNew ? null : id);

  if (isNew) return <NewBranchForm />;
  // Only block on the *initial* load; background reloads keep the form mounted.
  if (loading && !data) return <PageLoader label="Loading branch…" />;
  if (error || !data) {
    return (
      <div>
        <BackLink />
        <div className="glass rounded-3xl p-8 text-center">
          <p className="font-display text-lg font-bold text-ink">Couldn’t load this branch</p>
          <p className="mt-1 text-sm text-ink-soft">{error ?? 'It may have been deleted.'}</p>
        </div>
      </div>
    );
  }

  return <BranchEditor key={data.id} branch={data} onChanged={reload} />;
}
