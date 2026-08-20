import { cloneElement, isValidElement, useId } from 'react';
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
  const uid = useId();
  const hintId = `${uid}-hint`;
  const errorId = `${uid}-error`;
  const describedById = error ? errorId : hint ? hintId : undefined;

  // Link the control to its error/hint text for screen readers, and mark it
  // invalid when an error is present. Non-element children are left untouched.
  const control =
    isValidElement(children) && describedById
      ? cloneElement(children as any, {
          'aria-describedby':
            [(children as any).props['aria-describedby'], describedById].filter(Boolean).join(' '),
          'aria-invalid': error ? true : (children as any).props['aria-invalid'],
        })
      : children;

  return (
    <label htmlFor={htmlFor} className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink">{label}</span>
      {control}
      {hint && !error && (
        <span id={hintId} className="mt-1 block text-xs text-ink-soft">
          {hint}
        </span>
      )}
      {error && (
        <span id={errorId} role="alert" className="mt-1 block text-xs font-medium text-coral">
          {error}
        </span>
      )}
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
