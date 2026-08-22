import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ImageOff, Plus, SlidersHorizontal } from 'lucide-react';
import { useAdminProducts } from '../../hooks/useAdminProducts';
import { useCategories } from '../../hooks/useCategories';
import { useDebounce } from '../../hooks/useDebounce';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { PageHeader } from '../../components/admin/ui/PageHeader';
import { SearchInput } from '../../components/admin/ui/SearchInput';
import { Select } from '../../components/admin/ui/Field';
import { DataTable } from '../../components/admin/ui/DataTable';
import type { Column } from '../../components/admin/ui/DataTable';
import { Pagination } from '../../components/admin/ui/Pagination';
import { ProductStatusBadge } from '../../components/admin/ui/StatusBadge';
import { formatPHP } from '../../utils/format';
import { sized } from '../../utils/image';
import type { AdminProductCard, AdminProductParams, AdminProductSort, ProductStatus } from '../../types/admin';

const PAGE_SIZE = 20;

const STATUSES: { value: '' | ProductStatus; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ARCHIVED', label: 'Archived' },
];
const STATUS_VALUES = ['ACTIVE', 'DRAFT', 'ARCHIVED'];

const SORTS: { value: AdminProductSort; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'name', label: 'Name: A–Z' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
];
const SORT_VALUES = SORTS.map((s) => s.value);

export function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  useDocumentTitle('Products');

  const urlQ = searchParams.get('q') ?? '';
  const category = searchParams.get('category') ?? '';
  const rawStatus = searchParams.get('status') ?? '';
  const status = STATUS_VALUES.includes(rawStatus) ? (rawStatus as ProductStatus) : undefined;
  const rawSort = searchParams.get('sort') ?? 'newest';
  const sort = (SORT_VALUES as string[]).includes(rawSort) ? (rawSort as AdminProductSort) : 'newest';
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

  const { data: categories } = useCategories();

  const params: AdminProductParams = {
    q: urlQ || undefined,
    category: category || undefined,
    status,
    sort,
    page,
    pageSize: PAGE_SIZE,
  };
  const { data, loading, error } = useAdminProducts(params);

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

  const columns: Column<AdminProductCard>[] = [
    {
      key: 'product',
      header: 'Product',
      render: (p) => (
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/70 ring-1 ring-white/70">
            {p.image ? (
              <img src={sized(p.image, 'sm')} alt="" className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <ImageOff size={16} className="text-ink-soft" />
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{p.name}</p>
            <p className="truncate text-xs text-ink-soft">{p.model ?? p.brand}</p>
          </div>
        </div>
      ),
    },
    { key: 'category', header: 'Category', className: 'text-ink-soft', render: (p) => p.categoryName },
    { key: 'status', header: 'Status', render: (p) => <ProductStatusBadge status={p.status} /> },
    {
      key: 'price',
      header: 'Base price',
      align: 'right',
      render: (p) => (
        <div>
          <span className="font-semibold text-ink">{formatPHP(p.basePrice)}</span>
          {p.discountPct > 0 && <span className="ml-1.5 text-xs font-semibold text-coral">-{p.discountPct}%</span>}
        </div>
      ),
    },
    {
      key: 'variants',
      header: 'Variants',
      align: 'right',
      className: 'text-ink-soft',
      render: (p) => (
        <span>
          <span className="font-semibold text-ink">{p.activeVariantCount}</span>/{p.variantCount}
        </span>
      ),
    },
    {
      key: 'stock',
      header: 'Stock',
      align: 'right',
      render: (p) => (
        <span className={p.totalStock <= 0 ? 'font-semibold text-coral' : 'font-semibold text-ink'}>
          {p.totalStock}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Manage the catalog — details, variants, images, and pricing."
        actions={
          <button
            onClick={() => navigate('/admin/products/new')}
            className="flex items-center gap-1.5 rounded-full brand-gradient px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition-transform hover:scale-[1.02] active:scale-95"
          >
            <Plus size={16} /> New product
          </button>
        }
      />

      {/* toolbar */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput
          value={term}
          onChange={setTerm}
          placeholder="Search by name, model or SKU…"
          aria-label="Search products"
          className="lg:max-w-sm lg:flex-1"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={status ?? ''}
            onChange={(e) => updateParams({ status: e.target.value || null, page: null })}
            aria-label="Filter by status"
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
              aria-label="Sort products"
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
        keyOf={(p) => p.id}
        loading={loading}
        error={error}
        emptyMessage="No products match your filters."
        skeletonRows={PAGE_SIZE}
        onRowClick={(p) => navigate(`/admin/products/${p.id}`)}
        rowLabel={(p) => `Edit ${p.name}`}
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
