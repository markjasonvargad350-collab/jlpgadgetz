import { AlertCircle, PackageSearch } from 'lucide-react';
import { ProductCard } from '../ProductCard';
import type { ProductCard as ProductCardType } from '../../types/api';

interface ProductGridProps {
  products: ProductCardType[];
  loading?: boolean;
  error?: string | null;
  skeletonCount?: number;
  emptyMessage?: string;
  /** Tailwind columns override (defaults to a responsive 1→2→3→4 grid). */
  columnsClass?: string;
}

const DEFAULT_COLUMNS = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

/** Shared catalog grid: handles loading skeletons, error, and empty states. */
export function ProductGrid({
  products,
  loading = false,
  error = null,
  skeletonCount = 4,
  emptyMessage = 'No products found.',
  columnsClass = DEFAULT_COLUMNS,
}: ProductGridProps) {
  if (loading) {
    return (
      <div className={`grid gap-4 ${columnsClass}`}>
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <div key={i} className="glass h-80 animate-pulse rounded-3xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass flex items-center gap-3 rounded-3xl p-5">
        <AlertCircle className="shrink-0 text-coral" />
        <div>
          <p className="font-semibold">Couldn’t load products</p>
          <p className="text-sm text-ink-soft">{error}</p>
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="glass flex flex-col items-center gap-2 rounded-3xl p-12 text-center">
        <PackageSearch className="text-brand-400" size={32} />
        <p className="font-semibold">{emptyMessage}</p>
        <p className="text-sm text-ink-soft">Try adjusting your search or filters.</p>
      </div>
    );
  }

  return (
    <div className={`grid gap-4 ${columnsClass}`}>
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
