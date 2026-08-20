import type { ReactNode } from 'react';

/**
 * Frosted glass surface — the base card for the whole admin. Uses the shared
 * `glass` utility from index.css. Padding is left to the caller so the same card
 * wraps both spacious panels and flush data tables.
 */
export function GlassCard({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`glass rounded-3xl ${className}`}>{children}</div>;
}
