import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Boxes, Layers, PackageCheck, PackageX, SlidersHorizontal, Wallet } from 'lucide-react';
import { useAdminInventory } from '../../hooks/useAdminInventory';
import { useInventoryStats } from '../../hooks/useInventoryStats';
import { useCategories } from '../../hooks/useCategories';
import { useDebounce } from '../../hooks/useDebounce';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { PageHeader } from '../../components/admin/ui/PageHeader';
import { StatTile } from '../../components/admin/ui/StatTile';
import { SearchInput } from '../../components/admin/ui/SearchInput';
import { Select } from '../../components/admin/ui/Field';
import { DataTable } from '../../components/admin/ui/DataTable';
import type { Column } from '../../components/admin/ui/DataTable';
import { Pagination } from '../../components/admin/ui/Pagination';
import { StockStatusBadge } from '../../components/admin/ui/StatusBadge';
import { AdjustStockModal } from '../../components/admin/AdjustStockModal';
import type { AdjustTarget } from '../../components/admin/AdjustStockModal';
import { formatPHP } from '../../utils/format';
import type { InventoryRow, InventoryParams, InventoryStatusFilter, InventorySort } from '../../types/admin';

const PAGE_SIZE = 20;

const STATUSES: { value: InventoryStatusFilter; label: string }[] = [
  { value: 'all', label: 'All stock' },
  { value: 'in', label: 'In stock' },
  { value: 'low', label: 'Low stock' },
  { value: 'out', label: 'Out of stock' },
];
const STATUS_VALUES = STATUSES.map((s) => s.value);

const SORTS: { value: InventorySort; label: string }[] = [
  { value: 'stock_asc', label: 'Stock: Low to High' },
  { value: 'stock_desc', label: 'Stock: High to Low' },
  { value: 'sku', label: 'SKU: A–Z' },
  { value: 'updated', label: 'Recently updated' },
];
const SORT_VALUES = SORTS.map((s) => s.value);

export function InventoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAdmin } = useAdminAuth();
  useDocumentTitle('Inventory');

  const urlQ = searchParams.get('q') ?? '';
  const category = searchParams.get('category') ?? '';
  const rawStatus = searchParams.get('status') ?? 'all';
  const status = (STATUS_VALUES as string[]).includes(rawStatus) ? (rawStatus as InventoryStatusFilter) : 'all';
  const rawSort = searchParams.get('sort') ?? 'stock_asc';
  const sort = (SORT_VALUES as string[]).includes(rawSort) ? (rawSort as InventorySort) : 'stock_asc';
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

  const { data: categories } = useCategories();
  const stats = useInventoryStats();

  const params: InventoryParams = {
    q: urlQ || undefined,
    category: category || undefined,
    status,
    sort,
    page,
    pageSize: PAGE_SIZE,
  };
  const { data, loading, error, reload } = useAdminInventory(params);

  const [target, setTarget] = useState<AdjustTarget | null>(null);

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

  function openAdjust(row: InventoryRow) {
    setTarget({
      variantId: row.variantId,
      sku: row.sku,
      label: `${row.storage} · ${row.color}`,
      productName: row.productName,
      stock: row.stock,
      lowStockThreshold: row.lowStockThreshold,
    });
  }

  const columns: Column<InventoryRow>[] = [
    {
      key: 'product',
      header: 'Product',
      render: (r) => (
        <div className="flex items-center gap-3">
          <span
            className="h-7 w-7 shrink-0 rounded-full ring-1 ring-white/70"
            style={{ backgroundColor: r.colorHex ?? '#e5e0da' }}
            aria-hidden
          />
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{r.productName}</p>
            <p className="truncate text-xs text-ink-soft">
              {r.storage} · {r.color}
            </p>
          </div>
        </div>
      ),
    },
    { key: 'sku', header: 'SKU', className: 'font-mono text-xs text-ink-soft', render: (r) => r.sku },
    {
      key: 'stock',
      header: 'On hand',
      align: 'right',
      render: (r) => (
        <div>
          <span className="font-display text-base font-bold text-ink">{r.stock}</span>
          {r.reservedStock > 0 && <span className="ml-1 text-xs text-ink-soft">({r.reservedStock} held)</span>}
        </div>
      ),
    },
    { key: 'threshold', header: 'Low at', align: 'right', className: 'text-ink-soft', render: (r) => r.lowStockThreshold },
    { key: 'status', header: 'Status', render: (r) => <StockStatusBadge status={r.status} /> },
    { key: 'value', header: 'Value', align: 'right', render: (r) => formatPHP(r.stock * r.price) },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) =>
        isAdmin ? (
          <button
            onClick={() => openAdjust(r)}
            className="rounded-full bg-white/70 px-3 py-1.5 text-xs font-semibold text-brand-700 transition-colors hover:bg-white"
          >
            Adjust
          </button>
        ) : (
          <span className="text-xs text-ink-soft">—</span>
        ),
    },
  ];

  return (
    <div>
      <PageHeader title="Inventory" subtitle="Live stock across every variant, straight from the ledger." />

      {/* stat tiles */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile label="Variants" value={stats.data?.totalVariants ?? 0} icon={Boxes} hint={`${stats.data?.activeVariants ?? 0} active`} loading={stats.loading} />
        <StatTile label="In stock" value={stats.data?.inStock ?? 0} icon={PackageCheck} loading={stats.loading} />
        <StatTile label="Low stock" value={stats.data?.low ?? 0} icon={AlertTriangle} loading={stats.loading} />
        <StatTile label="Out of stock" value={stats.data?.out ?? 0} icon={PackageX} loading={stats.loading} />
        <StatTile label="Units on hand" value={stats.data?.totalUnits ?? 0} icon={Layers} loading={stats.loading} />
        <StatTile label="Stock value" value={formatPHP(stats.data?.totalStockValue ?? 0)} icon={Wallet} loading={stats.loading} />
      </div>

      {/* toolbar */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput
          value={term}
          onChange={setTerm}
          placeholder="Search by product or SKU…"
          aria-label="Search inventory"
          className="lg:max-w-sm lg:flex-1"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={status}
            onChange={(e) => updateParams({ status: e.target.value === 'all' ? null : e.target.value, page: null })}
            aria-label="Filter by stock status"
            className="w-auto"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
          <Select
            value={category}
            onChange={(e) => updateParams({ category: e.target.value || null, page: null })}
            aria-label="Filter by category"
            className="w-auto"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </Select>
          <label className="flex items-center gap-2 rounded-2xl bg-white/60 px-3.5 py-2.5 text-sm ring-1 ring-white/70 focus-within:ring-2 focus-within:ring-brand-400">
            <SlidersHorizontal size={15} className="text-ink-soft" />
            <select
              value={sort}
              onChange={(e) => updateParams({ sort: e.target.value, page: null })}
              aria-label="Sort inventory"
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

      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        keyOf={(r) => r.variantId}
        loading={loading}
        error={error}
        emptyMessage="No variants match your filters."
        skeletonRows={PAGE_SIZE}
      />

      <Pagination
        page={page}
        totalPages={data?.totalPages ?? 1}
        onPage={(p) => updateParams({ page: String(p) })}
        total={data?.total}
        pageSize={PAGE_SIZE}
      />

      <AdjustStockModal
        target={target}
        open={target !== null}
        onClose={() => setTarget(null)}
        onAdjusted={() => {
          reload();
          stats.reload();
        }}
      />
    </div>
  );
}
