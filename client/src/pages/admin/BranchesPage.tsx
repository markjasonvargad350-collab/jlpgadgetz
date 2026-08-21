import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useAdminBranches } from '../../hooks/useAdminBranches';
import { useDebounce } from '../../hooks/useDebounce';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { PageHeader } from '../../components/admin/ui/PageHeader';
import { SearchInput } from '../../components/admin/ui/SearchInput';
import { Select } from '../../components/admin/ui/Field';
import { DataTable } from '../../components/admin/ui/DataTable';
import type { Column } from '../../components/admin/ui/DataTable';
import { Pagination } from '../../components/admin/ui/Pagination';
import { Badge } from '../../components/admin/ui/StatusBadge';
import { formatBranchLocation } from '../../utils/format';
import type { AdminBranch, AdminBranchParams } from '../../types/admin';

const PAGE_SIZE = 50;

const ACTIVE_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'All branches' },
  { value: 'true', label: 'Active only' },
  { value: 'false', label: 'Inactive only' },
];
const ACTIVE_VALUES = ['true', 'false'];

/**
 * Branch list. Branches are a convenience for customers — they pick the shop
 * nearest them — so nothing here affects the catalog, which stays global.
 */
export function BranchesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  useDocumentTitle('Branches');

  const urlQ = searchParams.get('q') ?? '';
  const rawActive = searchParams.get('active') ?? '';
  const active = ACTIVE_VALUES.includes(rawActive) ? rawActive === 'true' : undefined;
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);

  // Search box — URL is the source of truth; debounce writes back.
  const [term, setTerm] = useState(urlQ);
  const debouncedTerm = useDebounce(term, 350);
  useEffect(() => {
    const current = searchParams.get('q') ?? '';
    if (debouncedTerm === current) return;
    updateParams({ q: debouncedTerm || null, page: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedTerm]);
  useEffect(() => setTerm((prev) => (prev === urlQ ? prev : urlQ)), [urlQ]);

  const params: AdminBranchParams = {
    q: urlQ || undefined,
    active,
    page,
    pageSize: PAGE_SIZE,
  };
  const { data, loading, error } = useAdminBranches(params);

  function updateParams(patch: Record<string, string | null>) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === '') next.delete(k);
        else next.set(k, v);
      }
      return next;
    });
  }

  const columns: Column<AdminBranch>[] = [
    {
      key: 'branch',
      header: 'Branch',
      render: (b) => (
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
            {b.name}
            {b.isDefault && <Badge label="Main" tone="brand" />}
          </p>
          <p className="text-xs text-ink-soft">{formatBranchLocation(b) || 'No address on record'}</p>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (b) => (
        <div className="min-w-0 text-xs text-ink-soft">
          <p>{b.phone ?? '—'}</p>
          <p className="break-all">{b.email ?? '—'}</p>
        </div>
      ),
    },
    { key: 'hours', header: 'Hours', render: (b) => <span className="text-xs text-ink-soft">{b.hours ?? '—'}</span> },
    {
      key: 'usage',
      header: 'In use by',
      align: 'right',
      render: (b) => (
        <span className="text-xs text-ink-soft">
          {b.orderCount} order{b.orderCount === 1 ? '' : 's'} · {b.tradeInCount} trade-in
          {b.tradeInCount === 1 ? '' : 's'} · {b.installmentCount} plan{b.installmentCount === 1 ? '' : 's'}
        </span>
      ),
    },
    { key: 'position', header: 'Order', align: 'right', render: (b) => <span className="text-ink-soft">{b.position}</span> },
    {
      key: 'status',
      header: 'Status',
      render: (b) =>
        b.isActive ? <Badge label="Active" tone="emerald" dot /> : <Badge label="Hidden" tone="slate" dot />,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Branches"
        subtitle="The shops customers can choose from. Stock and prices are shared across all of them."
        actions={
          <button
            onClick={() => navigate('/admin/branches/new')}
            className="flex items-center gap-2 rounded-full brand-gradient px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition-transform hover:scale-[1.02] active:scale-95"
          >
            <Plus size={16} /> New branch
          </button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput
          value={term}
          onChange={setTerm}
          placeholder="Search by name, city or province…"
          aria-label="Search branches"
          className="lg:max-w-sm lg:flex-1"
        />
        <Select
          value={rawActive}
          onChange={(e) => updateParams({ active: e.target.value || null, page: null })}
          aria-label="Filter by visibility"
          className="w-auto"
        >
          {ACTIVE_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </Select>
      </div>

      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        keyOf={(b) => b.id}
        loading={loading}
        error={error}
        emptyMessage="No branches yet. Add your first one to let customers pick a shop."
        skeletonRows={5}
        onRowClick={(b) => navigate(`/admin/branches/${b.id}`)}
        rowLabel={(b) => `Edit ${b.name}`}
      />

      <Pagination
        page={page}
        totalPages={data?.totalPages ?? 1}
        onPage={(p) => updateParams({ page: String(p) })}
        total={data?.total}
        pageSize={PAGE_SIZE}
      />
    </div>
  );
}
