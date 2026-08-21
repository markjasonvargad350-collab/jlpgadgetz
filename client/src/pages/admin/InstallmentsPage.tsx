import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAdminInstallments } from '../../hooks/useAdminInstallments';
import { useDebounce } from '../../hooks/useDebounce';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { PageHeader } from '../../components/admin/ui/PageHeader';
import { SearchInput } from '../../components/admin/ui/SearchInput';
import { Select } from '../../components/admin/ui/Field';
import { DataTable } from '../../components/admin/ui/DataTable';
import type { Column } from '../../components/admin/ui/DataTable';
import { Pagination } from '../../components/admin/ui/Pagination';
import { InstallmentStatusBadge } from '../../components/admin/ui/StatusBadge';
import { formatPHP, formatPHPExact, formatDateTime } from '../../utils/format';
import type { AdminInstallmentCard, AdminInstallmentParams } from '../../types/admin';
import type { InstallmentStatus } from '../../types/installment';

const PAGE_SIZE = 20;

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELLED', label: 'Cancelled' },
];
const STATUS_VALUES: InstallmentStatus[] = ['PENDING', 'APPROVED', 'ACTIVE', 'COMPLETED', 'REJECTED', 'CANCELLED'];

/** Installment applications. Staff review each one and record payments by hand. */
export function InstallmentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  useDocumentTitle('Installments');

  const urlQ = searchParams.get('q') ?? '';
  const rawStatus = searchParams.get('status') ?? '';
  const status = STATUS_VALUES.includes(rawStatus as InstallmentStatus) ? (rawStatus as InstallmentStatus) : undefined;
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);

  const [term, setTerm] = useState(urlQ);
  const debouncedTerm = useDebounce(term, 350);
  useEffect(() => {
    const current = searchParams.get('q') ?? '';
    if (debouncedTerm === current) return;
    updateParams({ q: debouncedTerm || null, page: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedTerm]);
  useEffect(() => setTerm((prev) => (prev === urlQ ? prev : urlQ)), [urlQ]);

  const params: AdminInstallmentParams = {
    q: urlQ || undefined,
    status,
    page,
    pageSize: PAGE_SIZE,
  };
  const { data, loading, error } = useAdminInstallments(params);

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

  const columns: Column<AdminInstallmentCard>[] = [
    {
      key: 'reference',
      header: 'Reference',
      render: (p) => (
        <div className="min-w-0">
          <p className="font-semibold text-ink">{p.reference}</p>
          <p className="text-xs text-ink-soft">{formatDateTime(p.appliedAt)}</p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (p) => (
        <div className="min-w-0">
          <p className="truncate text-ink">{p.customerName}</p>
          <p className="text-xs text-ink-soft">{p.branch?.name ?? 'No branch chosen'}</p>
        </div>
      ),
    },
    { key: 'product', header: 'Product', render: (p) => <span className="text-ink">{p.product}</span> },
    {
      key: 'plan',
      header: 'Plan',
      align: 'right',
      render: (p) => (
        <div className="text-right">
          <p className="font-semibold text-ink">
            {formatPHPExact(p.monthlyAmount)} <span className="text-xs font-normal text-ink-soft">/mo</span>
          </p>
          <p className="text-xs text-ink-soft">
            {p.termMonths} months · {formatPHP(p.principal)} total
          </p>
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (p) => <InstallmentStatusBadge status={p.status} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Installments"
        subtitle="Applications to pay in monthly instalments. You approve each plan and record every payment."
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput
          value={term}
          onChange={setTerm}
          placeholder="Search by reference, name, email or product…"
          aria-label="Search installments"
          className="lg:max-w-sm lg:flex-1"
        />
        <Select
          value={rawStatus}
          onChange={(e) => updateParams({ status: e.target.value || null, page: null })}
          aria-label="Filter by status"
          className="w-auto"
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </Select>
      </div>

      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        keyOf={(p) => p.id}
        loading={loading}
        error={error}
        emptyMessage="No installment applications yet."
        skeletonRows={6}
        onRowClick={(p) => navigate(`/admin/installments/${p.id}`)}
        rowLabel={(p) => `Open ${p.reference}`}
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
