import type { ReactNode } from 'react';

/** Section title + optional subtitle and right-aligned action (e.g. a link). */
export function SectionHeading({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h2 className="font-display text-2xl font-extrabold sm:text-3xl">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
