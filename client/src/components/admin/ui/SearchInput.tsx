import { Search, X } from 'lucide-react';

/**
 * Controlled glass search box (icon + clear button). The parent owns the value;
 * pair it with `useDebounce` before pushing the term to a query, exactly like
 * the storefront CatalogPage.
 */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  className = '',
  'aria-label': ariaLabel = 'Search',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
}) {
  return (
    <div className={`flex items-center gap-2 rounded-2xl bg-white/60 px-3.5 py-2.5 ring-1 ring-white/70 ${className}`}>
      <Search size={16} className="shrink-0 text-ink-soft" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-soft"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="shrink-0 text-ink-soft transition-colors hover:text-ink"
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}
