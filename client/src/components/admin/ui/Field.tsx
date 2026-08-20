import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

/** Labeled form control wrapper with optional hint + error message. */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string | null;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-ink-soft">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-medium text-coral">{error}</span>}
    </label>
  );
}

// Shared control chrome so inputs, selects, and textareas look identical.
const CONTROL =
  'w-full rounded-2xl bg-white/60 px-4 py-2.5 text-sm text-ink ring-1 ring-white/70 outline-none transition-shadow placeholder:text-ink-soft focus:ring-2 focus:ring-brand-400 disabled:opacity-60';

/** Glass-styled text input used across admin forms. */
export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${CONTROL} ${className}`} {...props} />;
}

/** Glass-styled native select. Caret is drawn by the browser (kept simple). */
export function Select({ className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${CONTROL} cursor-pointer pr-9 ${className}`} {...props}>
      {children}
    </select>
  );
}

/** Glass-styled multi-line input. */
export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${CONTROL} resize-y leading-relaxed ${className}`} {...props} />;
}
