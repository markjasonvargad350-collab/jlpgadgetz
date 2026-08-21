import { Prisma, ProductCondition } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { logAudit } from './audit.service';
import { assertBranchSelectable } from './branch.service';
import { dailyReferencePrefix, nextReferenceFrom } from '../utils/reference';
import type { CreateTradeInBody } from '../validators/tradein.validator';

// ── DTO shaping (shared by the public confirmation + the admin views) ─────────

export const tradeInSelect = {
  id: true,
  reference: true,
  customerName: true,
  customerEmail: true,
  customerPhone: true,
  deviceBrand: true,
  deviceModel: true,
  storage: true,
  color: true,
  condition: true,
  batteryHealth: true,
  imei: true,
  hasBox: true,
  hasCharger: true,
  issues: true,
  photos: true,
  status: true,
  quotedValue: true,
  finalValue: true,
  staffNotes: true,
  createdAt: true,
  updatedAt: true,
  branch: { select: { id: true, name: true, city: true, province: true } },
} satisfies Prisma.TradeInSelect;

type TradeInRow = Prisma.TradeInGetPayload<{ select: typeof tradeInSelect }>;

export function toTradeInDTO(t: TradeInRow) {
  return {
    id: t.id,
    reference: t.reference,
    status: t.status,
    customer: { name: t.customerName, email: t.customerEmail, phone: t.customerPhone },
    device: {
      brand: t.deviceBrand,
      model: t.deviceModel,
      storage: t.storage,
      color: t.color,
      condition: t.condition,
      batteryHealth: t.batteryHealth,
      imei: t.imei,
      hasBox: t.hasBox,
      hasCharger: t.hasCharger,
      issues: t.issues,
      photos: t.photos,
    },
    branch: t.branch,
    // Staff-entered valuation (null until quoted). Decimal → number for the client.
    quotedValue: t.quotedValue?.toNumber() ?? null,
    finalValue: t.finalValue?.toNumber() ?? null,
    staffNotes: t.staffNotes,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

export type TradeInDTO = ReturnType<typeof toTradeInDTO>;

async function loadTradeInById(id: string): Promise<TradeInDTO> {
  const row = await prisma.tradeIn.findUniqueOrThrow({ where: { id }, select: tradeInSelect });
  return toTradeInDTO(row);
}

// ── Public create ─────────────────────────────────────────────────────────────

/**
 * Submit a trade-in request (guest — no account). We snapshot the customer's
 * self-reported device details and mark it SUBMITTED. NO valuation is computed
 * here — staff review and price it in the back-office. The reference number is
 * generated the same way as order numbers (max+1 for the day) with a retry on a
 * unique collision from concurrent same-day submissions.
 */
export async function createTradeIn(input: CreateTradeInBody): Promise<TradeInDTO> {
  if (input.branchId) {
    await assertBranchSelectable(input.branchId);
  }

  const now = new Date();
  const MAX_ATTEMPTS = 5;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const prefix = dailyReferencePrefix('TRD', now);
      const last = await prisma.tradeIn.findFirst({
        where: { reference: { startsWith: prefix } },
        orderBy: { reference: 'desc' },
        select: { reference: true },
      });
      const reference = nextReferenceFrom(prefix, last?.reference ?? null);

      const created = await prisma.tradeIn.create({
        data: {
          reference,
          customerName: input.customer.name,
          customerEmail: input.customer.email,
          customerPhone: input.customer.phone,
          deviceBrand: input.device.brand,
          deviceModel: input.device.model,
          storage: input.device.storage,
          color: input.device.color,
          condition: input.device.condition ?? ProductCondition.PREOWNED,
          batteryHealth: input.device.batteryHealth,
          imei: input.device.imei,
          hasBox: input.device.hasBox ?? false,
          hasCharger: input.device.hasCharger ?? false,
          issues: input.device.issues,
          photos: input.device.photos ?? [],
          branchId: input.branchId ?? null,
        },
        select: { id: true, reference: true },
      });

      await logAudit({
        action: 'tradein.create',
        entityType: 'TradeIn',
        entityId: created.id,
        meta: { reference: created.reference, device: `${input.device.brand} ${input.device.model}` },
      });

      return loadTradeInById(created.id);
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
