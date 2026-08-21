import type { ChangeEvent, ReactNode } from 'react';

/**
 * Storefront form controls shared by the trade-in and installment applications.
 *
 * These mirror the field styling that CheckoutPage defines locally — same glass
 * inputs, same coral error state, same `aria-invalid`/`aria-describedby` wiring —
 * factored out here because two new pages need them. Checkout is left untouched.
 */

/** Input/textarea/select surface, with the invalid state folded in. */
export function controlClass(hasError: boolean): string {
  return `w-full rounded-2xl border bg-white/70 px-4 py-3 text-sm outline-none transition-shadow placeholder:text-ink-soft/70 focus:ring-2 ${
    hasError ? 'border-coral/60 focus:ring-coral/30' : 'border-white/70 focus:border-brand-300 focus:ring-brand-200'
  }`;
}

interface ShellProps {
  label: string;
  name: string;
  error?: string;
  optional?: boolean;
  hint?: string;
  className?: string;
  children: ReactNode;
}

/** Label + control + inline error, so every control renders identically. */
function FieldShell({ label, name, error, optional, hint, className = '', children }: ShellProps) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 flex items-center gap-1 text-sm font-semibold text-ink">
        {label}
        {optional && <span className="text-xs font-normal text-ink-soft">(optional)</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-ink-soft">{hint}</span>}
      {error && (
        <span id={`${name}-error`} role="alert" className="mt-1 block text-xs font-medium text-coral">
          {error}
        </span>
      )}
    </label>
  );
}

interface TextFieldProps extends Omit<ShellProps, 'children'> {
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
  inputMode?: 'text' | 'email' | 'tel' | 'numeric' | 'decimal';
  maxLength?: number;
}

export function TextField({
  value,
  onChange,
  placeholder,
  type = 'text',
  autoComplete,
  inputMode,
  maxLength,
  ...shell
}: TextFieldProps) {
  return (
    <FieldShell {...shell}>
      <input
        name={shell.name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        type={type}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        aria-invalid={!!shell.error}
        aria-describedby={shell.error ? `${shell.name}-error` : undefined}
        className={controlClass(!!shell.error)}
      />
    </FieldShell>
  );
}

interface TextAreaFieldProps extends Omit<ShellProps, 'children'> {
  value: string;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
}

export function TextAreaField({
  value,
  onChange,
  placeholder,
  rows = 4,
  maxLength,
  ...shell
}: TextAreaFieldProps) {
  return (
    <FieldShell {...shell}>
      <textarea
        name={shell.name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        aria-invalid={!!shell.error}
        aria-describedby={shell.error ? `${shell.name}-error` : undefined}
        className={`${controlClass(!!shell.error)} resize-y`}
      />
    </FieldShell>
  );
}

interface SelectFieldProps extends Omit<ShellProps, 'children'> {
  value: string;
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string }[];
}

export function SelectField({ value, onChange, options, ...shell }: SelectFieldProps) {
  return (
    <FieldShell {...shell}>
      <select
        name={shell.name}
        value={value}
        onChange={onChange}
        aria-invalid={!!shell.error}
        aria-describedby={shell.error ? `${shell.name}-error` : undefined}
        className={controlClass(!!shell.error)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

interface CheckboxCardProps {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon?: ReactNode;
}

/** Toggle styled like the payment radio cards, for yes/no device extras. */
export function CheckboxCard({ label, hint, checked, onChange, icon }: CheckboxCardProps) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors ${
        checked ? 'border-brand-400 bg-white/70' : 'border-white/60 bg-white/40 hover:bg-white/60'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
          checked ? 'brand-gradient text-white' : 'bg-white/70 text-ink-soft'
        }`}
      >
        {icon}
      </span>
      <span className="flex-1">
        <span className="font-semibold text-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-ink-soft">{hint}</span>}
      </span>
    </label>
  );
}
