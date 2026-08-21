import { Prisma, InstallmentStatus, InstallmentPaymentStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { money } from '../utils/money';
import { logAudit } from './audit.service';
import {
  installmentSelect,
  toInstallmentDTO,
  loadInstallmentById,
  type InstallmentDTO,
} from './installment.service';
import type {
  AdminInstallmentQueryInput,
  UpdateInstallmentStatusInput,
  RecordPaymentInput,
} from '../validators/installment.validator';

// ── List (card DTO) ────────────────────────────────────────────────────────

const installmentCardSelect = {
  id: true,
  reference: true,
  customerName: true,
  productName: true,
  variantLabel: true,
  status: true,
  termMonths: true,
  principal: true,
  monthlyAmount: true,
  createdAt: true,
  branch: { select: { id: true, name: true } },
} satisfies Prisma.InstallmentPlanSelect;

type InstallmentCardRow = Prisma.InstallmentPlanGetPayload<{ select: typeof installmentCardSelect }>;

function toInstallmentCard(p: InstallmentCardRow) {
  return {
    id: p.id,
    reference: p.reference,
    customerName: p.customerName,
    product: p.variantLabel ? `${p.productName} · ${p.variantLabel}` : p.productName,
    status: p.status,
    termMonths: p.termMonths,
    principal: p.principal.toNumber(),
    monthlyAmount: p.monthlyAmount.toNumber(),
    branch: p.branch,
    appliedAt: p.createdAt.toISOString(),
  };
}

export async function listInstallments(query: AdminInstallmentQueryInput) {
  const where: Prisma.InstallmentPlanWhereInput = {};
  if (query.status) where.status = query.status;
  if (query.q) {
    where.OR = [
      { reference: { contains: query.q, mode: 'insensitive' } },
      { customerName: { contains: query.q, mode: 'insensitive' } },
      { customerEmail: { contains: query.q, mode: 'insensitive' } },
      { customerPhone: { contains: query.q, mode: 'insensitive' } },
      { productName: { contains: query.q, mode: 'insensitive' } },
    ];
  }

  const skip = (query.page - 1) * query.pageSize;
  const [total, rows] = await Promise.all([
    prisma.installmentPlan.count({ where }),
    prisma.installmentPlan.findMany({
      where,
      select: installmentCardSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip,
      take: query.pageSize,
    }),
  ]);

  return {
    items: rows.map(toInstallmentCard),
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export async function getInstallment(id: string): Promise<InstallmentDTO> {
  const row = await prisma.installmentPlan.findUnique({ where: { id }, select: installmentSelect });
  if (!row) {
    throw ApiError.notFound('Installment plan not found');
  }
  return toInstallmentDTO(row);
}

// ── Workflow ─────────────────────────────────────────────────────────────────

/**
 * Legal next-states per status. PENDING → APPROVED (or reject/cancel); APPROVED
 * → ACTIVE (or cancel); ACTIVE → COMPLETED (or cancel). COMPLETED is normally
 * reached automatically once every payment row is PAID, but staff may also set
 * it. REJECTED / COMPLETED / CANCELLED are terminal. Enforced server-side.
 */
const ALLOWED_TRANSITIONS: Record<InstallmentStatus, InstallmentStatus[]> = {
  PENDING: [InstallmentStatus.APPROVED, InstallmentStatus.REJECTED, InstallmentStatus.CANCELLED],
  APPROVED: [InstallmentStatus.ACTIVE, InstallmentStatus.CANCELLED],
  ACTIVE: [InstallmentStatus.COMPLETED, InstallmentStatus.CANCELLED],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
};

/**
 * Advance a plan's status and/or edit staff notes. A status change is applied
 * with a compare-and-set (`updateMany` guarded by the status we read) so two
 * admins can't both drive the plan forward from the same state. This never
 * touches money or payment rows.
 */
export async function updateInstallmentStatus(
  id: string,
  input: UpdateInstallmentStatusInput,
  adminId?: string,
): Promise<InstallmentDTO> {
  const existing = await prisma.installmentPlan.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!existing) {
    throw ApiError.notFound('Installment plan not found');
  }

  const changingStatus = input.status !== existing.status;
  if (changingStatus && !ALLOWED_TRANSITIONS[existing.status].includes(input.status)) {
    throw ApiError.unprocessable(
      `Cannot move an installment plan from ${existing.status} to ${input.status}.`,
      { from: existing.status, to: input.status, allowed: ALLOWED_TRANSITIONS[existing.status] },
    );
  }

  const data: Prisma.InstallmentPlanUncheckedUpdateInput = { status: input.status };
  if (input.staffNotes !== undefined) data.staffNotes = input.staffNotes;
  // Provenance: record which admin approved/actioned the plan (loose ref, no FK).
  if (changingStatus) data.approvedByAdminId = adminId ?? null;

  if (changingStatus) {
    const moved = await prisma.installmentPlan.updateMany({
      where: { id, status: existing.status },
      data,
    });
    if (moved.count !== 1) {
      throw ApiError.conflict('This plan changed since you loaded it. Refresh and try again.', {
        from: existing.status,
        to: input.status,
      });
    }
  } else {
    await prisma.installmentPlan.update({ where: { id }, data });
  }

  await logAudit({
    adminId,
    action: 'installment.status',
    entityType: 'InstallmentPlan',
    entityId: id,
    meta: changingStatus ? { from: existing.status, to: input.status } : { fields: ['staffNotes'] },
  });

  return getInstallment(id);
}

// ── Record a payment (additive ledger — rows are updated, never deleted) ───────

/**
 * Record a payment against one schedule row. Rules:
 *  • the plan must be APPROVED or ACTIVE (approve it first; can't pay a rejected/
 *    cancelled/completed plan),
 *  • `amount` is capped at the row's remaining balance — NO overpay,
 *  • the row is marked PAID once `amountPaid` reaches `amountDue`,
 *  • the plan flips to COMPLETED automatically when every row is PAID, and a
 *    first payment on an APPROVED plan activates it (→ ACTIVE).
 * All updates happen inside one `$transaction`; nothing is ever deleted.
 */
export async function recordPayment(
  planId: string,
  paymentId: string,
  input: RecordPaymentInput,
  adminId?: string,
): Promise<InstallmentDTO> {
  const row = await prisma.installmentPayment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      planId: true,
      amountDue: true,
      amountPaid: true,
      method: true,
      reference: true,
      plan: { select: { id: true, status: true } },
    },
  });
  if (!row || row.planId !== planId) {
    throw ApiError.notFound('Payment schedule row not found for this plan');
  }

  if (row.plan.status !== InstallmentStatus.APPROVED && row.plan.status !== InstallmentStatus.ACTIVE) {
    throw ApiError.unprocessable(
      `Payments can only be recorded on an APPROVED or ACTIVE plan (this plan is ${row.plan.status}).`,
      { status: row.plan.status },
    );
  }

  const remaining = row.amountDue.sub(row.amountPaid);
  if (remaining.lessThanOrEqualTo(0)) {
    throw ApiError.conflict('This installment is already fully paid.');
  }

  const amount = money(input.amount);
  if (amount.greaterThan(remaining)) {
    throw ApiError.unprocessable('Amount exceeds the remaining balance on this installment.', {
      remaining: remaining.toNumber(),
    });
  }

  const newPaid = row.amountPaid.add(amount);
  const nowPaid = newPaid.greaterThanOrEqualTo(row.amountDue);

  await prisma.$transaction(async (tx) => {
    await tx.installmentPayment.update({
      where: { id: paymentId },
      data: {
        amountPaid: newPaid,
        status: nowPaid ? InstallmentPaymentStatus.PAID : InstallmentPaymentStatus.PENDING,
        paidAt: nowPaid ? new Date() : null,
        // Keep the latest method/reference the staff supplied (if any).
        method: input.method ?? row.method,
        reference: input.reference ?? row.reference,
        recordedByAdminId: adminId ?? null,
      },
    });

    // Recompute plan status from the ledger: all rows PAID → COMPLETED; otherwise
    // a first payment on an APPROVED plan activates it.
    const unpaid = await tx.installmentPayment.count({
      where: { planId, status: { not: InstallmentPaymentStatus.PAID } },
    });
    let nextStatus = row.plan.status;
    if (unpaid === 0) nextStatus = InstallmentStatus.COMPLETED;
    else if (row.plan.status === InstallmentStatus.APPROVED) nextStatus = InstallmentStatus.ACTIVE;

    if (nextStatus !== row.plan.status) {
      await tx.installmentPlan.update({ where: { id: planId }, data: { status: nextStatus } });
    }
  });

  await logAudit({
    adminId,
    action: 'installment.payment',
    entityType: 'InstallmentPayment',
    entityId: paymentId,
    meta: { planId, amount: amount.toNumber(), fullyPaid: nowPaid },
  });

  return getInstallment(planId);
}
