import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Windowed page list: first, last, current±1, with gaps marked as ellipses. */
function pageWindow(page: number, totalPages: number): (number | 'gap')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const out: (number | 'gap')[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  if (start > 2) out.push('gap');
  for (let p = start; p <= end; p++) out.push(p);
  if (end < totalPages - 1) out.push('gap');
  out.push(totalPages);
  return out;
}

/**
 * Pagination bar: an optional "showing A–B of N" summary plus prev / numbered /
 * next controls. Renders nothing when there is a single page and no summary.
 */
export function Pagination({
  page,
  totalPages,
  onPage,
  total,
  pageSize,
}: {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
  total?: number;
  pageSize?: number;
}) {
  const showSummary = total !== undefined && pageSize !== undefined;
  if (totalPages <= 1 && !showSummary) return null;

  const from = showSummary && total! > 0 ? (page - 1) * pageSize! + 1 : 0;
  const to = showSummary ? Math.min(page * pageSize!, total!) : 0;

  return (
    <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
      {showSummary && (
        <p className="text-sm text-ink-soft">
          {total! > 0 ? (
            <>
              Showing <span className="font-semibold text-ink">{from}</span>–
              <span className="font-semibold text-ink">{to}</span> of{' '}
              <span className="font-semibold text-ink">{total}</span>
            </>
          ) : (
            'No results'
          )}
        </p>
      )}

      {totalPages > 1 && (
        <div className="flex items-center gap-1.5">
          <PagerButton disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
            <ChevronLeft size={16} />
          </PagerButton>
          {pageWindow(page, totalPages).map((p, i) =>
            p === 'gap' ? (
              <span key={`gap-${i}`} className="px-1 text-sm text-ink-soft">
                …
              </span>
            ) : (
              <button
                key={p}
                onClick={() => onPage(p)}
                aria-current={p === page ? 'page' : undefined}
                className={`grid h-9 min-w-9 place-items-center rounded-xl px-2 text-sm font-semibold transition-colors ${
                  p === page ? 'brand-gradient text-white shadow-sm' : 'bg-white/60 text-ink hover:bg-white/80'
                }`}
              >
                {p}
              </button>
            ),
          )}
          <PagerButton disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Next page">
            <ChevronRight size={16} />
          </PagerButton>
        </div>
      )}
    </div>
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
      className="grid h-9 w-9 place-items-center rounded-xl bg-white/60 text-ink transition-colors hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-40"
      {...rest}
    >
      {children}
    </button>
  );
}
