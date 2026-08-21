import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from 'lucide-react';
import { useProducts } from '../hooks/useProducts';
import { useCategories } from '../hooks/useCategories';
import { useDebounce } from '../hooks/useDebounce';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { ProductGrid } from '../components/store/ProductGrid';
import type { ProductListParams, ProductSort } from '../types/api';

const WIDTH = 'mx-auto w-[min(100%-1.5rem,76rem)]';

const SORTS: { value: ProductSort; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'bestselling', label: 'Best selling' },
  { value: 'name', label: 'Name: A–Z' },
];

const SORT_VALUES = SORTS.map((s) => s.value);
const PAGE_SIZE = 12;

export function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const urlQ = searchParams.get('q') ?? '';
  const category = searchParams.get('category') ?? '';
  const rawSort = searchParams.get('sort') ?? 'newest';
  const sort = (SORT_VALUES as string[]).includes(rawSort) ? (rawSort as ProductSort) : 'newest';
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const inStockOnly = searchParams.get('inStock') === 'true';
  const deal = searchParams.get('deal') === 'true';
  const bestSeller = searchParams.get('bestSeller') === 'true';
  const newArrival = searchParams.get('newArrival') === 'true';
  const featured = searchParams.get('featured') === 'true';
  const preOwned = searchParams.get('preOwned') === 'true';
  const minPrice = searchParams.get('minPrice') ?? '';
  const maxPrice = searchParams.get('maxPrice') ?? '';

  // --- search box (URL is the source of truth; debounce writes back) --------
  const [term, setTerm] = useState(urlQ);
  const debouncedTerm = useDebounce(term, 350);

  useEffect(() => {
    const current = searchParams.get('q') ?? '';
    if (debouncedTerm === current) return;
    updateParams({ q: debouncedTerm || null, page: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedTerm]);

  // Keep the box in sync when the URL query changes elsewhere (e.g. nav search).
  useEffect(() => {
    setTerm((prev) => (prev === urlQ ? prev : urlQ));
  }, [urlQ]);

  // --- price inputs (applied explicitly) ------------------------------------
  const [minInput, setMinInput] = useState(minPrice);
  const [maxInput, setMaxInput] = useState(maxPrice);
  useEffect(() => setMinInput(minPrice), [minPrice]);
  useEffect(() => setMaxInput(maxPrice), [maxPrice]);

  const { data: categories, error: categoriesError, reload: reloadCategories } = useCategories();

  const params: ProductListParams = {
    q: urlQ || undefined,
    category: category || undefined,
    sort,
    page,
    pageSize: PAGE_SIZE,
    inStock: inStockOnly || undefined,
    deal: deal || undefined,
    bestSeller: bestSeller || undefined,
    newArrival: newArrival || undefined,
    featured: featured || undefined,
    preOwned: preOwned || undefined,
    minPrice: minPrice ? Number(minPrice) : undefined,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
  };

  const { data, loading, error } = useProducts(params);

  function updateParams(patch: Record<string, string | null>) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (v === null || v === '') next.delete(k);
          else next.set(k, v);
        }
        return next;
      },
      { replace: false },
    );
  }

  function applyPrice() {
    updateParams({ minPrice: minInput || null, maxPrice: maxInput || null, page: null });
  }

  const activeCategory = categories.find((c) => c.slug === category);
  const hasFilters = Boolean(
    category ||
      urlQ ||
      inStockOnly ||
      deal ||
      bestSeller ||
      newArrival ||
      featured ||
      preOwned ||
      minPrice ||
      maxPrice,
  );

  const title = urlQ
    ? `Results for “${urlQ}”`
    : activeCategory
      ? activeCategory.name
      : deal
        ? 'Today’s deals'
        : bestSeller
          ? 'Best sellers'
          : newArrival
            ? 'New arrivals'
            : featured
              ? 'Featured'
              : preOwned
                ? 'Pre-owned'
                : 'All products';

  useDocumentTitle(title);

  const totalPages = data?.totalPages ?? 1;

  return (
    <div className={`${WIDTH} pt-10`}>
      {/* header */}
      <div className="mb-6">
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">{title}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {loading ? 'Loading…' : `${data?.total ?? 0} product${(data?.total ?? 0) === 1 ? '' : 's'}`}
        </p>
      </div>

      {/* search + sort row */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-2 rounded-full glass px-4 py-2.5 focus-within:ring-2 focus-within:ring-brand-400">
          <Search size={18} className="text-ink-soft" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search products…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-ink-soft"
            aria-label="Search products"
          />
          {term && (
            <button onClick={() => setTerm('')} aria-label="Clear search" className="text-ink-soft hover:text-ink">
              <X size={16} />
            </button>
          )}
        </div>
        <label className="flex items-center gap-2 rounded-full glass px-4 py-2.5 text-sm font-medium focus-within:ring-2 focus-within:ring-brand-400">
          <SlidersHorizontal size={16} className="text-ink-soft" />
          <span className="text-ink-soft">Sort</span>
          <select
            value={sort}
            onChange={(e) => updateParams({ sort: e.target.value, page: null })}
            className="bg-transparent font-semibold text-ink outline-none"
            aria-label="Sort products"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* category chips */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Chip active={!category} onClick={() => updateParams({ category: null, page: null })}>
          All
        </Chip>
        {categories.map((c) => (
          <Chip
            key={c.id}
            active={category === c.slug}
            onClick={() => updateParams({ category: category === c.slug ? null : c.slug, page: null })}
          >
            {c.name}
          </Chip>
        ))}
        {categoriesError && (
          <span className="flex items-center gap-2 text-sm text-ink-soft" role="alert">
            {categoriesError}
            <button onClick={reloadCategories} className="font-semibold text-brand-700 hover:underline">
              Retry
            </button>
          </span>
        )}
      </div>

      {/* secondary filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 rounded-full glass px-4 py-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => updateParams({ inStock: e.target.checked ? 'true' : null, page: null })}
            className="accent-brand-600"
          />
          In stock only
        </label>

        <label className="flex cursor-pointer items-center gap-2 rounded-full glass px-4 py-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={preOwned}
            onChange={(e) => updateParams({ preOwned: e.target.checked ? 'true' : null, page: null })}
            className="accent-brand-600"
          />
          Pre-owned only
        </label>

        <div className="flex items-center gap-2 rounded-full glass px-3 py-1.5 text-sm focus-within:ring-2 focus-within:ring-brand-400">
          <span className="text-ink-soft">₱</span>
          <input
            type="number"
            min={0}
            value={minInput}
            onChange={(e) => setMinInput(e.target.value)}
            placeholder="Min"
            className="w-16 bg-transparent outline-none placeholder:text-ink-soft"
            aria-label="Minimum price"
          />
          <span className="text-ink-soft">–</span>
          <input
            type="number"
            min={0}
            value={maxInput}
            onChange={(e) => setMaxInput(e.target.value)}
            placeholder="Max"
            className="w-16 bg-transparent outline-none placeholder:text-ink-soft"
            aria-label="Maximum price"
          />
          <button
            onClick={applyPrice}
            className="rounded-full brand-gradient px-3 py-1 text-xs font-semibold text-white"
          >
            Apply
          </button>
        </div>

        {hasFilters && (
          <Link
            to="/shop"
            onClick={() => setTerm('')}
            className="flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"
          >
            <X size={14} /> Clear all
          </Link>
        )}
      </div>

      {/* grid */}
      <ProductGrid
        products={data?.items ?? []}
        loading={loading}
        error={error}
        skeletonCount={PAGE_SIZE}
        emptyMessage="No products match your filters."
      />

      {/* pagination */}
      {!loading && !error && totalPages > 1 && (
        <div className="mt-10 flex items-center justify-center gap-2">
          <PagerButton
            disabled={page <= 1}
            onClick={() => updateParams({ page: String(page - 1) })}
            aria-label="Previous page"
          >
            <ChevronLeft size={18} />
          </PagerButton>
          {Array.from({ length: totalPages }).map((_, i) => {
            const p = i + 1;
            return (
              <button
                key={p}
                onClick={() => updateParams({ page: String(p) })}
                className={`grid h-10 w-10 place-items-center rounded-full text-sm font-semibold transition-colors ${
                  p === page ? 'brand-gradient text-white' : 'glass text-ink hover:bg-white/80'
                }`}
                aria-current={p === page ? 'page' : undefined}
              >
                {p}
              </button>
            );
          })}
          <PagerButton
            disabled={page >= totalPages}
            onClick={() => updateParams({ page: String(page + 1) })}
            aria-label="Next page"
          >
            <ChevronRight size={18} />
          </PagerButton>
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
        active ? 'brand-gradient text-white shadow-sm' : 'glass text-ink hover:bg-white/80'
      }`}
    >
      {children}
    </button>
  );
}

function PagerButton({
  disabled,
  onClick,
  children,
  ...rest
}: {
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="grid h-10 w-10 place-items-center rounded-full glass text-ink transition-colors hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-40"
      {...rest}
    >
      {children}
    </button>
  );
}
