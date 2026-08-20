import type { ReactNode } from 'react';

export interface Column<T> {
  /** Stable key for the column. */
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  /** Extra classes for both header + body cells (alignment, width, hide-on-mobile). */
  className?: string;
  /** Horizontal alignment of the cell content. */
  align?: 'left' | 'right' | 'center';
}

const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' } as const;

/**
 * A glass data table with built-in loading (skeleton), error, and empty states.
 * Generic over the row type; the caller supplies columns and a stable key.
 * Wrapped in a horizontally scrollable surface so dense tables stay usable on
 * narrow screens.
 */
export function DataTable<T>({
  columns,
  rows,
  keyOf,
  loading = false,
  error = null,
  emptyMessage = 'Nothing to show.',
  skeletonRows = 8,
  onRowClick,
  rowLabel,
}: {
  columns: Column<T>[];
  rows: T[];
  keyOf: (row: T) => string;
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  skeletonRows?: number;
  onRowClick?: (row: T) => void;
  /** Accessible label for a clickable row (e.g. "Edit iPhone 15"); used when `onRowClick` is set. */
  rowLabel?: (row: T) => string;
}) {
  return (
    <div className="glass overflow-hidden rounded-3xl">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-white/60 text-left">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`px-4 py-3 text-xs font-semibold tracking-wide text-ink-soft uppercase ${ALIGN[c.align ?? 'left']} ${c.className ?? ''}`}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/50">
            {loading ? (
              Array.from({ length: skeletonRows }).map((_, r) => (
                <tr key={r}>
                  {columns.map((c) => (
                    <td key={c.key} className={`px-4 py-3.5 ${c.className ?? ''}`}>
                      <span className="block h-4 w-full max-w-[8rem] animate-pulse rounded bg-white/70" />
                    </td>
                  ))}
                </tr>
              ))
            ) : error ? (
              <tr>
                <td colSpan={columns.length} role="alert" className="px-4 py-14 text-center text-sm text-coral">
                  {error}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-14 text-center text-sm text-ink-soft">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={keyOf(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onRowClick(row);
                          }
                        }
                      : undefined
                  }
                  tabIndex={onRowClick ? 0 : undefined}
                  role={onRowClick ? 'button' : undefined}
                  aria-label={onRowClick ? rowLabel?.(row) : undefined}
                  className={`transition-colors ${
                    onRowClick
                      ? 'cursor-pointer hover:bg-white/50 focus-visible:bg-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-inset'
                      : ''
                  }`}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={`px-4 py-3.5 align-middle ${ALIGN[c.align ?? 'left']} ${c.className ?? ''}`}>
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
