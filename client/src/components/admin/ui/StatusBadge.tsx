import type { ProductStatus, StockStatus } from '../../../types/admin';
import type { OrderStatus, PaymentStatus } from '../../../types/order';
import type { TradeInStatus } from '../../../types/tradeIn';
import type { InstallmentStatus, InstallmentPaymentStatus } from '../../../types/installment';

/** Soft tinted pill palettes. Numeric shades come from Tailwind's default theme
 *  (augmented, not replaced, by the Sunset-Glass brand tokens). */
const TONES = {
  emerald: 'bg-emerald-500/12 text-emerald-700 ring-emerald-600/20',
  amber: 'bg-amber-500/15 text-amber-700 ring-amber-600/25',
  rose: 'bg-rose-500/12 text-rose-700 ring-rose-600/20',
  slate: 'bg-slate-500/10 text-slate-600 ring-slate-500/20',
  sky: 'bg-sky-500/12 text-sky-700 ring-sky-600/20',
  violet: 'bg-violet-500/12 text-violet-700 ring-violet-600/20',
  brand: 'bg-brand-500/12 text-brand-700 ring-brand-600/20',
} as const;

export type BadgeTone = keyof typeof TONES;

/** Small status pill. `dot` prepends a filled indicator dot. */
export function Badge({ label, tone = 'slate', dot = false }: { label: string; tone?: BadgeTone; dot?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset whitespace-nowrap ${TONES[tone]}`}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {label}
    </span>
  );
}

const PRODUCT_STATUS: Record<ProductStatus, { label: string; tone: BadgeTone }> = {
  ACTIVE: { label: 'Active', tone: 'emerald' },
  DRAFT: { label: 'Draft', tone: 'slate' },
  ARCHIVED: { label: 'Archived', tone: 'amber' },
};

export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  const s = PRODUCT_STATUS[status] ?? { label: status, tone: 'slate' as const };
  return <Badge label={s.label} tone={s.tone} dot />;
}

const STOCK_STATUS: Record<StockStatus, { label: string; tone: BadgeTone }> = {
  IN_STOCK: { label: 'In stock', tone: 'emerald' },
  LOW: { label: 'Low', tone: 'amber' },
  OUT: { label: 'Out', tone: 'rose' },
};

export function StockStatusBadge({ status }: { status: StockStatus }) {
  const s = STOCK_STATUS[status];
  return <Badge label={s.label} tone={s.tone} dot />;
}

// Fulfillment lifecycle: neutral at intake → cool while processing → violet in
// transit → amber at the doorstep → green delivered; cancelled is rose.
const ORDER_STATUS: Record<OrderStatus, { label: string; tone: BadgeTone }> = {
  RECEIVED: { label: 'Received', tone: 'slate' },
  PROCESSING: { label: 'Processing', tone: 'sky' },
  PACKED: { label: 'Packed', tone: 'sky' },
  SHIPPED: { label: 'Shipped', tone: 'violet' },
  IN_TRANSIT: { label: 'In transit', tone: 'violet' },
  OUT_FOR_DELIVERY: { label: 'Out for delivery', tone: 'amber' },
  DELIVERED: { label: 'Delivered', tone: 'emerald' },
  CANCELLED: { label: 'Cancelled', tone: 'rose' },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const s = ORDER_STATUS[status] ?? { label: status, tone: 'slate' as const };
  return <Badge label={s.label} tone={s.tone} dot />;
}

const PAYMENT_STATUS: Record<PaymentStatus, { label: string; tone: BadgeTone }> = {
  PENDING: { label: 'Pending', tone: 'amber' },
  PAID: { label: 'Paid', tone: 'emerald' },
  FAILED: { label: 'Failed', tone: 'rose' },
  REFUNDED: { label: 'Refunded', tone: 'violet' },
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const s = PAYMENT_STATUS[status] ?? { label: status, tone: 'slate' as const };
  return <Badge label={s.label} tone={s.tone} dot />;
}

// Trade-in workflow: neutral at intake → cool under inspection → brand once staff
// have priced it → green when accepted/closed; declined and cancelled are muted rose.
const TRADE_IN_STATUS: Record<TradeInStatus, { label: string; tone: BadgeTone }> = {
  SUBMITTED: { label: 'Submitted', tone: 'slate' },
  REVIEWING: { label: 'Reviewing', tone: 'sky' },
  QUOTED: { label: 'Quoted', tone: 'brand' },
  ACCEPTED: { label: 'Accepted', tone: 'violet' },
  COMPLETED: { label: 'Completed', tone: 'emerald' },
  DECLINED: { label: 'Declined', tone: 'rose' },
  CANCELLED: { label: 'Cancelled', tone: 'rose' },
};

export function TradeInStatusBadge({ status }: { status: TradeInStatus }) {
  const s = TRADE_IN_STATUS[status] ?? { label: status, tone: 'slate' as const };
  return <Badge label={s.label} tone={s.tone} dot />;
}

const INSTALLMENT_STATUS: Record<InstallmentStatus, { label: string; tone: BadgeTone }> = {
  PENDING: { label: 'Pending', tone: 'amber' },
  APPROVED: { label: 'Approved', tone: 'sky' },
  ACTIVE: { label: 'Active', tone: 'violet' },
  COMPLETED: { label: 'Completed', tone: 'emerald' },
  REJECTED: { label: 'Rejected', tone: 'rose' },
  CANCELLED: { label: 'Cancelled', tone: 'rose' },
};

export function InstallmentStatusBadge({ status }: { status: InstallmentStatus }) {
  const s = INSTALLMENT_STATUS[status] ?? { label: status, tone: 'slate' as const };
  return <Badge label={s.label} tone={s.tone} dot />;
}

const INSTALLMENT_PAYMENT_STATUS: Record<InstallmentPaymentStatus, { label: string; tone: BadgeTone }> = {
  PENDING: { label: 'Unpaid', tone: 'slate' },
  PAID: { label: 'Paid', tone: 'emerald' },
};

/**
 * One schedule row's state. "Overdue" is deliberately not a stored status — pass
 * `overdue` when `dueDate` has passed and the row is still unpaid.
 */
export function InstallmentPaymentStatusBadge({
  status,
  overdue = false,
}: {
  status: InstallmentPaymentStatus;
  overdue?: boolean;
}) {
  if (status === 'PENDING' && overdue) return <Badge label="Overdue" tone="rose" dot />;
  const s = INSTALLMENT_PAYMENT_STATUS[status] ?? { label: status, tone: 'slate' as const };
  return <Badge label={s.label} tone={s.tone} dot />;
}
