import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SlidersHorizontal } from 'lucide-react';
import { useAdminOrders } from '../../hooks/useAdminOrders';
import { useDebounce } from '../../hooks/useDebounce';
import { PageHeader } from '../../components/admin/ui/PageHeader';
import { SearchInput } from '../../components/admin/ui/SearchInput';
import { Select, Input } from '../../components/admin/ui/Field';
import { DataTable } from '../../components/admin/ui/DataTable';
import type { Column } from '../../components/admin/ui/DataTable';
import { Pagination } from '../../components/admin/ui/Pagination';
import { OrderStatusBadge, PaymentStatusBadge } from '../../components/admin/ui/StatusBadge';
import { formatPHP, formatDate } from '../../utils/format';
import type { AdminOrderCard, AdminOrderParams, OrderSort } from '../../types/admin';
import type { OrderStatus, PaymentStatus } from '../../types/order';

const PAGE_SIZE = 20;

const ORDER_STATUSES: { value: '' | OrderStatus; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'RECEIVED', label: 'Received' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'PACKED', label: 'Packed' },
  { value: 'SHIPPED', label: 'Shipped' },
  { value: 'IN_TRANSIT', label: 'In transit' },
  { value: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
];
const ORDER_STATUS_VALUES = ORDER_STATUSES.map((s) => s.value).filter(Boolean);

const PAYMENT_STATUSES: { value: '' | PaymentStatus; label: string }[] = [
  { value: '', label: 'All payments' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PAID', label: 'Paid' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'REFUNDED', label: 'Refunded' },
];
const PAYMENT_STATUS_VALUES = PAYMENT_STATUSES.map((s) => s.value).filter(Boolean);

const SORTS: { value: OrderSort; label: string }[] = [
  { value: 'placed_desc', label: 'Newest first' },
  { value: 'placed_asc', label: 'Oldest first' },
  { value: 'total_desc', label: 'Total: High to Low' },
  { value: 'total_asc', label: 'Total: Low to High' },
];
const SORT_VALUES = SORTS.map((s) => s.value);

const PAYMENT_METHOD_LABEL: Record<AdminOrderCard['paymentMethod'], string> = {
  COD: 'Cash on delivery',
  GCASH: 'GCash',
  BANK_TRANSFER: 'Bank transfer',
};

export function OrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const urlQ = searchParams.get('q') ?? '';
  const rawStatus = searchParams.get('status') ?? '';
  const status = (ORDER_STATUS_VALUES as string[]).includes(rawStatus) ? (rawStatus as OrderStatus) : undefined;
  const rawPayment = searchParams.get('paymentStatus') ?? '';
  const paymentStatus = (PAYMENT_STATUS_VALUES as string[]).includes(rawPayment)
    ? (rawPayment as PaymentStatus)
    : undefined;
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';
  const rawSort = searchParams.get('sort') ?? 'placed_desc';
  const sort = (SORT_VALUES as string[]).includes(rawSort) ? (rawSort as OrderSort) : 'placed_desc';
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

  const params: AdminOrderParams = {
    q: urlQ || undefined,
    status,
    paymentStatus,
    from: from || undefined,
    to: to || undefined,
    sort,
    page,
    pageSize: PAGE_SIZE,
  };
  const { data, loading, error } = useAdminOrders(params);

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

  const columns: Column<AdminOrderCard>[] = [
    {
      key: 'order',
      header: 'Order',
      render: (o) => (
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold text-ink">{o.orderNumber}</p>
          <p className="text-xs text-ink-soft">{formatDate(o.placedAt)}</p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (o) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{o.customerName}</p>
          <p className="text-xs text-ink-soft">
            {o.itemCount} item{o.itemCount === 1 ? '' : 's'}
          </p>
        </div>
      ),
    },
    { key: 'total', header: 'Total', align: 'right', render: (o) => <span className="font-semibold text-ink">{formatPHP(o.total)}</span> },
    { key: 'status', header: 'Status', render: (o) => <OrderStatusBadge status={o.status} /> },
    {
      key: 'payment',
      header: 'Payment',
      render: (o) => (
        <div className="flex flex-col items-start gap-1">
          <PaymentStatusBadge status={o.paymentStatus} />
          <span className="text-xs text-ink-soft">{PAYMENT_METHOD_LABEL[o.paymentMethod]}</span>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Orders" subtitle="Every order, its payment, and its fulfillment status." />

      {/* toolbar */}
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SearchInput
            value={term}
            onChange={setTerm}
            placeholder="Search by order #, name, email or phone…"
            aria-label="Search orders"
            className="lg:max-w-sm lg:flex-1"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={status ?? ''}
              onChange={(e) => updateParams({ status: e.target.value || null, page: null })}
              aria-label="Filter by order status"
              className="w-auto"
            >
              {ORDER_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
            <Select
              value={paymentStatus ?? ''}
              onChange={(e) => updateParams({ paymentStatus: e.target.value || null, page: null })}
              aria-label="Filter by payment status"
              className="w-auto"
            >
              {PAYMENT_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
            <label className="flex items-center gap-2 rounded-2xl bg-white/60 px-3.5 py-2.5 text-sm ring-1 ring-white/70">
              <SlidersHorizontal size={15} className="text-ink-soft" />
              <select
                value={sort}
                onChange={(e) => updateParams({ sort: e.target.value, page: null })}
                aria-label="Sort orders"
                className="cursor-pointer bg-transparent font-semibold text-ink outline-none"
              >
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        {/* date range */}
        <div className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
          <span className="font-semibold text-ink">Placed between</span>
          <Input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => updateParams({ from: e.target.value || null, page: null })}
            aria-label="Placed from date"
            className="w-auto"
          />
          <span>and</span>
          <Input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => updateParams({ to: e.target.value || null, page: null })}
            aria-label="Placed to date"
            className="w-auto"
          />
          {(from || to) && (
            <button
              onClick={() => updateParams({ from: null, to: null, page: null })}
              className="rounded-full bg-white/70 px-3 py-1.5 text-xs font-semibold text-brand-700 transition-colors hover:bg-white"
            >
              Clear dates
            </button>
          )}
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        keyOf={(o) => o.orderNumber}
        loading={loading}
        error={error}
        emptyMessage="No orders match your filters."
        skeletonRows={PAGE_SIZE}
        onRowClick={(o) => navigate(`/admin/orders/${o.orderNumber}`)}
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
