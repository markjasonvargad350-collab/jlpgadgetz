// Installment types — mirror the server's InstallmentDTO + quote response
// (services/installment.service.ts) and the installment validators exactly.
//
// JLP installments are plain **price ÷ months** with an optional down payment:
// no interest, no service fee. Every peso figure here is COMPUTED BY THE SERVER
// from the stored variant price — the client only ever sends a variantId, a
// term, and a down payment, and displays what comes back.

import type { PaymentMethod } from './order';
import type { ProductCondition } from './api';

export type InstallmentStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED';

export type InstallmentPaymentStatus = 'PENDING' | 'PAID';

/** Contact details of the (account-less) applicant. */
export interface InstallmentCustomer {
  name: string;
  email: string;
  phone: string;
}

/** Query for GET /api/installments/quote — a preview that persists nothing. */
export interface InstallmentQuoteParams {
  variantId: string;
  termMonths: number;
  downPayment?: number;
}

/** One month of a previewed (not yet persisted) schedule. */
export interface QuoteScheduleRow {
  sequence: number;
  amountDue: number;
}

/**
 * Server-computed schedule preview. `monthlyAmount` is the headline figure; the
 * final row in `schedule` absorbs any rounding remainder so the rows sum to
 * `principal` exactly.
 */
export interface InstallmentQuote {
  variantId: string;
  productName: string;
  variantLabel: string;
  condition: ProductCondition;
  price: number;
  termMonths: number;
  downPayment: number;
  /** Smallest down payment this product accepts (its minDownPct × price). */
  minDownPayment: number;
  principal: number;
  monthlyAmount: number;
  schedule: QuoteScheduleRow[];
}

/** Request body for POST /api/installments. Never carries prices or monthlies. */
export interface CreateInstallmentRequest {
  customer: InstallmentCustomer;
  variantId: string;
  termMonths: number;
  downPayment?: number;
  /** Preferred branch for handover / payments. */
  branchId?: string;
}

/** Branch summary embedded in a plan (null when none was chosen). */
export interface InstallmentBranch {
  id: string;
  name: string;
  city: string | null;
  province: string | null;
}

/** Product snapshot taken at apply time — the price here is never overwritten. */
export interface InstallmentProduct {
  name: string;
  variantLabel: string | null;
  price: number;
  variantId: string | null;
}

/** One persisted schedule row. Rows are updated when paid, NEVER deleted. */
export interface InstallmentScheduleRow {
  id: string;
  sequence: number;
  dueDate: string;
  amountDue: number;
  amountPaid: number;
  status: InstallmentPaymentStatus;
  paidAt: string | null;
  method: PaymentMethod | null;
  reference: string | null;
}

/** Full plan (public confirmation + the admin detail view). */
export interface InstallmentDTO {
  id: string;
  reference: string;
  status: InstallmentStatus;
  customer: InstallmentCustomer;
  product: InstallmentProduct;
  branch: InstallmentBranch | null;
  termMonths: number;
  downPayment: number;
  /** price − downPayment: the financed amount. */
  principal: number;
  monthlyAmount: number;
  /** Running totals derived from the (additive) payment rows. */
  totals: { paid: number; remaining: number };
  schedule: InstallmentScheduleRow[];
  staffNotes: string | null;
  createdAt: string;
  updatedAt: string;
}
