import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { money } from '../utils/money';
import { logAudit } from './audit.service';
import { assertBranchSelectable } from './branch.service';
import { dailyReferencePrefix, nextReferenceFrom } from '../utils/reference';
import {
  INSTALLMENT_TERMS,
  isValidTerm,
  computeSchedule,
  type InstallmentComputation,
} from '../config/installment';
import type {
  CreateInstallmentBody,
  QuoteInstallmentQuery,
} from '../validators/installment.validator';

// ── Shared DTO (public confirmation + admin detail) ───────────────────────────

export const installmentSelect = {
  id: true,
  reference: true,
  status: true,
  customerName: true,
  customerEmail: true,
  customerPhone: true,
  productName: true,
  variantLabel: true,
  productPrice: true,
  variantId: true,
  termMonths: true,
  downPayment: true,
  principal: true,
  monthlyAmount: true,
  staffNotes: true,
  createdAt: true,
  updatedAt: true,
  branch: { select: { id: true, name: true, city: true, province: true } },
  payments: {
    orderBy: { sequence: 'asc' },
    select: {
      id: true,
      sequence: true,
      dueDate: true,
      amountDue: true,
      amountPaid: true,
      status: true,
      paidAt: true,
      method: true,
      reference: true,
    },
  },
} satisfies Prisma.InstallmentPlanSelect;

type InstallmentRow = Prisma.InstallmentPlanGetPayload<{ select: typeof installmentSelect }>;

export function toInstallmentDTO(p: InstallmentRow) {
  const paid = p.payments.reduce((sum, r) => sum.add(r.amountPaid), new Prisma.Decimal(0));
  const remaining = p.principal.sub(paid);
  return {
    id: p.id,
    reference: p.reference,
    status: p.status,
    customer: { name: p.customerName, email: p.customerEmail, phone: p.customerPhone },
    product: {
      name: p.productName,
      variantLabel: p.variantLabel,
      price: p.productPrice.toNumber(),
      variantId: p.variantId,
    },
    branch: p.branch,
    termMonths: p.termMonths,
    downPayment: p.downPayment.toNumber(),
    principal: p.principal.toNumber(),
    monthlyAmount: p.monthlyAmount.toNumber(),
    // Running ledger totals derived from the (additive) payment rows.
    totals: { paid: paid.toNumber(), remaining: remaining.toNumber() },
    schedule: p.payments.map((r) => ({
      id: r.id,
      sequence: r.sequence,
      dueDate: r.dueDate.toISOString(),
      amountDue: r.amountDue.toNumber(),
      amountPaid: r.amountPaid.toNumber(),
      status: r.status,
      paidAt: r.paidAt?.toISOString() ?? null,
      method: r.method,
      reference: r.reference,
    })),
    staffNotes: p.staffNotes,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export type InstallmentDTO = ReturnType<typeof toInstallmentDTO>;

export async function loadInstallmentById(id: string): Promise<InstallmentDTO> {
  const row = await prisma.installmentPlan.findUniqueOrThrow({
    where: { id },
    select: installmentSelect,
  });
  return toInstallmentDTO(row);
}

// ── Server-authoritative resolution (shared by quote + create) ─────────────────

interface ResolvedInstallment {
  variantId: string;
  productName: string;
  variantLabel: string;
  condition: string;
  price: Prisma.Decimal;
  minDownPayment: Prisma.Decimal;
  downPayment: Prisma.Decimal;
  termMonths: number;
  computation: InstallmentComputation;
}

/**
 * Look the variant/product up in the DB and re-derive every money figure from
 * the stored price — the client's price/monthly are NEVER trusted. Enforces:
 * the product is buyable + installment-enabled, the term is allowed, and the
 * down payment sits in `[minDownPct·price, price)` so the financed principal is
 * strictly positive. Pure reads + arithmetic; throws ApiError on any violation.
 */
async function resolveInstallment(
  variantId: string,
  termMonths: number,
  downPaymentInput: number,
): Promise<ResolvedInstallment> {
  if (!isValidTerm(termMonths)) {
    throw ApiError.badRequest(`Term must be one of: ${INSTALLMENT_TERMS.join(', ')} months`);
  }

  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    select: {
      id: true,
      storage: true,
      color: true,
      condition: true,
      price: true,
      isActive: true,
      product: {
        select: {
          name: true,
          status: true,
          installmentAvailable: true,
          installmentMinDownPct: true,
        },
      },
    },
  });

  if (!variant || !variant.isActive || variant.product.status !== 'ACTIVE') {
    throw ApiError.notFound('That product option is not available.');
  }
  if (!variant.product.installmentAvailable) {
    throw ApiError.unprocessable('This product is not available for installment.');
  }

  // Authoritative price straight from the DB.
  const price = variant.price;
  const minPct = variant.product.installmentMinDownPct; // 0..90 (validated on the product)
  const minDownPayment = money((price.toNumber() * minPct) / 100);
  const downPayment = money(downPaymentInput);

  if (downPayment.lessThan(minDownPayment)) {
    throw ApiError.unprocessable(
      `Down payment must be at least ₱${minDownPayment.toFixed(2)} (${minPct}% of the price).`,
      { minDownPayment: minDownPayment.toNumber(), price: price.toNumber() },
    );
  }
  if (downPayment.greaterThanOrEqualTo(price)) {
    throw ApiError.unprocessable('Down payment must be less than the product price.', {
      price: price.toNumber(),
    });
  }

  const computation = computeSchedule(price, termMonths, downPayment);
  if (computation.principal.lessThanOrEqualTo(0)) {
    throw ApiError.unprocessable('The financed amount must be greater than zero.');
  }

  return {
    variantId: variant.id,
    productName: variant.product.name,
    variantLabel: `${variant.storage} · ${variant.color}`,
    condition: variant.condition,
    price,
    minDownPayment,
    downPayment,
    termMonths,
    computation,
  };
}

/**
 * Add `n` whole months to `date`, clamping the day to the target month's length
 * (so e.g. Jan 31 + 1 month → Feb 28/29 rather than rolling into March). Used to
 * spread the schedule's due dates one month apart from the application date.
 */
function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}

// ── Public quote (preview only — persists nothing) ────────────────────────────

export async function quoteInstallment(query: QuoteInstallmentQuery) {
  const r = await resolveInstallment(query.variantId, query.termMonths, query.downPayment);
  return {
    variantId: r.variantId,
    productName: r.productName,
    variantLabel: r.variantLabel,
    condition: r.condition,
    price: r.price.toNumber(),
    termMonths: r.termMonths,
    downPayment: r.downPayment.toNumber(),
    minDownPayment: r.minDownPayment.toNumber(),
    principal: r.computation.principal.toNumber(),
    monthlyAmount: r.computation.monthlyAmount.toNumber(),
    schedule: r.computation.rows.map((row) => ({
      sequence: row.sequence,
      amountDue: row.amountDue.toNumber(),
    })),
  };
}

// ── Public create ─────────────────────────────────────────────────────────────

/**
 * Apply for an installment plan (guest — no account). Re-derives all money from
 * the DB (see `resolveInstallment`), snapshots the product + price, and creates
 * the plan (PENDING) together with its full payment schedule in ONE transaction
 * so a plan never exists without its rows. Reference generation mirrors orders /
 * trade-ins (max+1 for the day) with a retry on a unique collision.
 */
export async function createInstallment(input: CreateInstallmentBody): Promise<InstallmentDTO> {
  if (input.branchId) {
    await assertBranchSelectable(input.branchId);
  }

  const r = await resolveInstallment(input.variantId, input.termMonths, input.downPayment);

  const now = new Date();
  const MAX_ATTEMPTS = 5;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const prefix = dailyReferencePrefix('INS', now);
      const last = await prisma.installmentPlan.findFirst({
        where: { reference: { startsWith: prefix } },
        orderBy: { reference: 'desc' },
        select: { reference: true },
      });
      const reference = nextReferenceFrom(prefix, last?.reference ?? null);

      const created = await prisma.$transaction(async (tx) => {
        const plan = await tx.installmentPlan.create({
          data: {
            reference,
            customerName: input.customer.name,
            customerEmail: input.customer.email,
            customerPhone: input.customer.phone,
            productName: r.productName,
            variantLabel: r.variantLabel,
            productPrice: r.price,
            variantId: r.variantId,
            branchId: input.branchId ?? null,
            termMonths: r.termMonths,
            downPayment: r.downPayment,
            principal: r.computation.principal,
            monthlyAmount: r.computation.monthlyAmount,
            // status defaults to PENDING — staff review before it becomes active.
          },
          select: { id: true, reference: true },
        });

        await tx.installmentPayment.createMany({
          data: r.computation.rows.map((row) => ({
            planId: plan.id,
            sequence: row.sequence,
            dueDate: addMonths(now, row.sequence),
            amountDue: row.amountDue,
            // amountPaid defaults 0, status defaults PENDING.
          })),
        });

        return plan;
      });

      await logAudit({
        action: 'installment.create',
        entityType: 'InstallmentPlan',
        entityId: created.id,
        meta: {
          reference: created.reference,
          product: r.productName,
          termMonths: r.termMonths,
          principal: r.computation.principal.toNumber(),
        },
      });

      return loadInstallmentById(created.id);
    } catch (err) {
      const isUniqueCollision =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
      if (isUniqueCollision && attempt < MAX_ATTEMPTS) {
        continue; // regenerate the reference against the now-higher max
      }
      throw err;
    }
  }

  throw ApiError.conflict('Could not allocate a reference, please try again.');
}
