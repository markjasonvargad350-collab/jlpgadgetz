import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAdminTradeIns } from '../../hooks/useAdminTradeIns';
import { useDebounce } from '../../hooks/useDebounce';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { PageHeader } from '../../components/admin/ui/PageHeader';
import { SearchInput } from '../../components/admin/ui/SearchInput';
import { Select } from '../../components/admin/ui/Field';
import { DataTable } from '../../components/admin/ui/DataTable';
import type { Column } from '../../components/admin/ui/DataTable';
import { Pagination } from '../../components/admin/ui/Pagination';
import { TradeInStatusBadge } from '../../components/admin/ui/StatusBadge';
import { formatPHP, formatDateTime } from '../../utils/format';
import type { AdminTradeInCard, AdminTradeInParams } from '../../types/admin';
import type { TradeInStatus } from '../../types/tradeIn';

const PAGE_SIZE = 20;

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'REVIEWING', label: 'Reviewing' },
  { value: 'QUOTED', label: 'Quoted' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'DECLINED', label: 'Declined' },
  { value: 'CANCELLED', label: 'Cancelled' },
];
const STATUS_VALUES: TradeInStatus[] = [
  'SUBMITTED',
  'REVIEWING',
  'QUOTED',
  'ACCEPTED',
  'COMPLETED',
  'DECLINED',
  'CANCELLED',
];

/** Trade-in queue. Staff price every device by hand — nothing here is automated. */
export function TradeInsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  useDocumentTitle('Trade-ins');

  const urlQ = searchParams.get('q') ?? '';
  const rawStatus = searchParams.get('status') ?? '';
  const status = STATUS_VALUES.includes(rawStatus as TradeInStatus) ? (rawStatus as TradeInStatus) : undefined;
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

  const params: AdminTradeInParams = {
    q: urlQ || undefined,
    status,
    page,
    pageSize: PAGE_SIZE,
  };
  const { data, loading, error } = useAdminTradeIns(params);

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

  const columns: Column<AdminTradeInCard>[] = [
    {
      key: 'reference',
      header: 'Reference',
      render: (t) => (
        <div className="min-w-0">
          <p className="font-semibold text-ink">{t.reference}</p>
          <p className="text-xs text-ink-soft">{formatDateTime(t.submittedAt)}</p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (t) => (
        <div className="min-w-0">
          <p className="truncate text-ink">{t.customerName}</p>
          <p className="text-xs text-ink-soft">{t.branch?.name ?? 'No branch chosen'}</p>
        </div>
      ),
    },
    { key: 'device', header: 'Device', render: (t) => <span className="text-ink">{t.device}</span> },
    {
      key: 'value',
      header: 'Offer',
      align: 'right',
      render: (t) => (
        <div className="text-right">
          {t.finalValue != null ? (
            <>
              <p className="font-semibold text-ink">{formatPHP(t.finalValue)}</p>
              <p className="text-xs text-ink-soft">final</p>
            </>
          ) : t.quotedValue != null ? (
            <>
              <p className="font-semibold text-ink">{formatPHP(t.quotedValue)}</p>
              <p className="text-xs text-ink-soft">quoted</p>
            </>
          ) : (
            <span className="text-xs text-ink-soft">Not priced yet</span>
          )}
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (t) => <TradeInStatusBadge status={t.status} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Trade-ins"
        subtitle="Devices customers want to sell or trade. You inspect and price each one yourself."
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput
          value={term}
          onChange={setTerm}
          placeholder="Search by reference, name, email or device…"
          aria-label="Search trade-ins"
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
        keyOf={(t) => t.id}
        loading={loading}
        error={error}
        emptyMessage="No trade-in requests yet."
        skeletonRows={6}
        onRowClick={(t) => navigate(`/admin/trade-ins/${t.id}`)}
        rowLabel={(t) => `Open ${t.reference}`}
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
