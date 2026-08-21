import { Prisma, TradeInStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { money } from '../utils/money';
import { logAudit } from './audit.service';
import { tradeInSelect, toTradeInDTO, type TradeInDTO } from './tradein.service';
import type { AdminTradeInQueryInput, UpdateTradeInInput } from '../validators/tradein.validator';

// ── List (card DTO) ────────────────────────────────────────────────────────

const tradeInCardSelect = {
  id: true,
  reference: true,
  customerName: true,
  deviceBrand: true,
  deviceModel: true,
  status: true,
  quotedValue: true,
  finalValue: true,
  createdAt: true,
  branch: { select: { id: true, name: true } },
} satisfies Prisma.TradeInSelect;

type TradeInCardRow = Prisma.TradeInGetPayload<{ select: typeof tradeInCardSelect }>;

function toTradeInCard(t: TradeInCardRow) {
  return {
    id: t.id,
    reference: t.reference,
    customerName: t.customerName,
    device: `${t.deviceBrand} ${t.deviceModel}`,
    status: t.status,
    quotedValue: t.quotedValue?.toNumber() ?? null,
    finalValue: t.finalValue?.toNumber() ?? null,
    branch: t.branch,
    submittedAt: t.createdAt.toISOString(),
  };
}

export async function listTradeIns(query: AdminTradeInQueryInput) {
  const where: Prisma.TradeInWhereInput = {};
  if (query.status) where.status = query.status;
  if (query.q) {
    where.OR = [
      { reference: { contains: query.q, mode: 'insensitive' } },
      { customerName: { contains: query.q, mode: 'insensitive' } },
      { customerEmail: { contains: query.q, mode: 'insensitive' } },
      { customerPhone: { contains: query.q, mode: 'insensitive' } },
      { deviceModel: { contains: query.q, mode: 'insensitive' } },
    ];
  }

  const skip = (query.page - 1) * query.pageSize;
  const [total, rows] = await Promise.all([
    prisma.tradeIn.count({ where }),
    prisma.tradeIn.findMany({
      where,
      select: tradeInCardSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip,
      take: query.pageSize,
    }),
  ]);

  return {
    items: rows.map(toTradeInCard),
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export async function getTradeIn(id: string): Promise<TradeInDTO> {
  const row = await prisma.tradeIn.findUnique({ where: { id }, select: tradeInSelect });
  if (!row) {
    throw ApiError.notFound('Trade-in request not found');
  }
  return toTradeInDTO(row);
}

// ── Workflow ─────────────────────────────────────────────────────────────────

/**
 * Legal next-states per status. Single-step forward progression, plus "decline
 * or cancel from any non-terminal state". DECLINED / COMPLETED / CANCELLED are
 * terminal. Enforced server-side — the client only sends a target status.
 */
const ALLOWED_TRANSITIONS: Record<TradeInStatus, TradeInStatus[]> = {
  SUBMITTED: [TradeInStatus.REVIEWING, TradeInStatus.DECLINED, TradeInStatus.CANCELLED],
  REVIEWING: [TradeInStatus.QUOTED, TradeInStatus.DECLINED, TradeInStatus.CANCELLED],
  QUOTED: [TradeInStatus.ACCEPTED, TradeInStatus.DECLINED, TradeInStatus.CANCELLED],
  ACCEPTED: [TradeInStatus.COMPLETED, TradeInStatus.CANCELLED],
  DECLINED: [],
  COMPLETED: [],
  CANCELLED: [],
};

/**
 * Update a trade-in: advance its status and/or record the staff valuation
 * (quotedValue / finalValue) + notes. The valuation is ALWAYS supplied by staff
 * — this endpoint validates it's `>= 0` but never derives it.
 *
 * A status change is applied with a compare-and-set (`updateMany` guarded by the
 * status we read) so two admins can't both drive the same request forward from
 * one state. Valuation/notes edits with no status change are a plain update.
 */
export async function updateTradeIn(
  id: string,
  input: UpdateTradeInInput,
  adminId?: string,
): Promise<TradeInDTO> {
  const existing = await prisma.tradeIn.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!existing) {
    throw ApiError.notFound('Trade-in request not found');
  }

  const changingStatus = input.status !== undefined && input.status !== existing.status;
  if (input.status !== undefined && input.status !== existing.status) {
    if (!ALLOWED_TRANSITIONS[existing.status].includes(input.status)) {
      throw ApiError.unprocessable(
        `Cannot move a trade-in from ${existing.status} to ${input.status}.`,
        { from: existing.status, to: input.status, allowed: ALLOWED_TRANSITIONS[existing.status] },
      );
    }
  }

  const data: Prisma.TradeInUncheckedUpdateInput = {};
  if (input.status !== undefined) data.status = input.status;
  if (input.quotedValue !== undefined) {
    data.quotedValue = input.quotedValue === null ? null : money(input.quotedValue);
  }
  if (input.finalValue !== undefined) {
    data.finalValue = input.finalValue === null ? null : money(input.finalValue);
  }
  if (input.staffNotes !== undefined) data.staffNotes = input.staffNotes;
  // Provenance: record which admin last acted on the request (loose ref, no FK).
  data.reviewedByAdminId = adminId ?? null;

  if (changingStatus) {
    const moved = await prisma.tradeIn.updateMany({ where: { id, status: existing.status }, data });
    if (moved.count !== 1) {
      throw ApiError.conflict('This trade-in changed since you loaded it. Refresh and try again.', {
        from: existing.status,
        to: input.status,
      });
    }
  } else {
    await prisma.tradeIn.update({ where: { id }, data });
  }

  await logAudit({
    adminId,
    action: 'tradein.update',
    entityType: 'TradeIn',
    entityId: id,
    meta: {
      fields: Object.keys(input),
      ...(changingStatus ? { from: existing.status, to: input.status } : {}),
    },
  });

  return getTradeIn(id);
}
