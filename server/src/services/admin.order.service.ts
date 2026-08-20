import { Prisma, OrderStatus, PaymentStatus, PaymentMethod, InventoryTxnType, ShipmentStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { recordInventoryChange } from './inventory.service';
import { logAudit } from './audit.service';
import { loadOrderDTOByNumber, type OrderDTO } from './order.service';
import { manilaRangeToUtc } from '../utils/time';
import { WAREHOUSE, noteForStatus, waypointForStatus, orderToShipmentStatus } from '../config/delivery';
import type { AdminOrderListQuery } from '../validators/admin.order.validator';

// ── Order list (card DTO) ────────────────────────────────────────────────────

const orderCardSelect = {
  orderNumber: true,
  customerName: true,
  total: true,
  status: true,
  paymentStatus: true,
  paymentMethod: true,
  createdAt: true,
  _count: { select: { items: true } },
} satisfies Prisma.OrderSelect;

type OrderCardRow = Prisma.OrderGetPayload<{ select: typeof orderCardSelect }>;

function toOrderCard(o: OrderCardRow) {
  return {
    orderNumber: o.orderNumber,
    customerName: o.customerName,
    itemCount: o._count.items,
    total: o.total.toNumber(),
    status: o.status,
    paymentStatus: o.paymentStatus,
    paymentMethod: o.paymentMethod,
    placedAt: o.createdAt.toISOString(),
  };
}

export async function listOrders(query: AdminOrderListQuery) {
  const where: Prisma.OrderWhereInput = {};
  if (query.status) where.status = query.status;
  if (query.paymentStatus) where.paymentStatus = query.paymentStatus;
  if (query.q) {
    where.OR = [
      { orderNumber: { contains: query.q, mode: 'insensitive' } },
      { customerName: { contains: query.q, mode: 'insensitive' } },
      { customerEmail: { contains: query.q, mode: 'insensitive' } },
      { customerPhone: { contains: query.q, mode: 'insensitive' } },
    ];
  }
  if (query.from || query.to) {
    // Inclusive Manila calendar-day boundaries → UTC instants (no DST).
    const range = manilaRangeToUtc(query.from, query.to);
    const createdAt: Prisma.DateTimeFilter = {};
    if (range.gte) createdAt.gte = range.gte;
    if (range.lte) createdAt.lte = range.lte;
    where.createdAt = createdAt;
  }

  // Every sort carries an `id` tiebreaker so pages don't reshuffle on ties
  // (many orders can share a createdAt / total).
  const orderBy: Prisma.OrderOrderByWithRelationInput[] =
    query.sort === 'placed_asc'
      ? [{ createdAt: 'asc' }, { id: 'asc' }]
      : query.sort === 'total_desc'
        ? [{ total: 'desc' }, { id: 'asc' }]
        : query.sort === 'total_asc'
          ? [{ total: 'asc' }, { id: 'asc' }]
          : [{ createdAt: 'desc' }, { id: 'asc' }]; // placed_desc (default)

  const skip = (query.page - 1) * query.pageSize;
  // count() + findMany() share the SAME `where` so total/totalPages never desync.
  const [total, rows] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({ where, select: orderCardSelect, orderBy, skip, take: query.pageSize }),
  ]);

  return {
    items: rows.map(toOrderCard),
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

/** Full order detail for the admin (session-gated, no email guard). */
export async function getOrderByNumberAdmin(orderNumber: string): Promise<OrderDTO> {
  return loadOrderDTOByNumber(orderNumber);
}

// ── Fulfillment state-machine ────────────────────────────────────────────────

/**
 * Legal next-states per current status. Strict single-step forward progression,
 * plus "cancel from any non-terminal state". DELIVERED and CANCELLED are terminal
 * (empty arrays) — which is exactly what stops a cancelled order being cancelled
 * (and thus restocked) twice.
 */
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  RECEIVED: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  PROCESSING: [OrderStatus.PACKED, OrderStatus.CANCELLED],
  PACKED: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  SHIPPED: [OrderStatus.IN_TRANSIT, OrderStatus.CANCELLED],
  IN_TRANSIT: [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.CANCELLED],
  OUT_FOR_DELIVERY: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  DELIVERED: [],
  CANCELLED: [],
};

/** The single legal forward step from a status (null if none / terminal). */
export function nextForwardStatus(status: OrderStatus): OrderStatus | null {
  return ALLOWED_TRANSITIONS[status].find((s) => s !== OrderStatus.CANCELLED) ?? null;
}

/**
 * Advance (or cancel) an order's fulfillment status. The correctness-critical
 * path — everything runs in ONE transaction:
 *
 *   1. Load the order (status + items + shipment).
 *   2. Reject no-op (`from === next`, 422) and any illegal jump (422).
 *   3. **Compare-and-set** the status with `updateMany({ where:{ id, status: from }})`.
 *      Only the writer that still sees `from` gets `count === 1`; a concurrent
 *      second PATCH sees the freshly-committed row and gets `count === 0` → 409,
 *      so its side-effects (restock/refund) never run.
 *   4. On CANCELLED: restock each still-linked variant through the ledger
 *      (positive delta — always succeeds), roll back `soldQty` (floored at 0),
 *      refund a PAID order (simulated), and record the cancellation on the
 *      shipment timeline. On a forward step: append a tracking milestone, and
 *      auto-settle COD on DELIVERED.
 *
 * Cancellation can never double-restock: CANCELLED is terminal (a 2nd cancel is
 * rejected at the transition check), and the restock is strictly downstream of a
 * winning compare-and-set into CANCELLED.
 */
export async function updateOrderStatus(
  orderNumber: string,
  next: OrderStatus,
  adminId?: string,
): Promise<OrderDTO> {
  const { orderId, from } = await prisma.$transaction(
    async (tx) => {
      const order = await tx.order.findUnique({
        where: { orderNumber },
        select: {
          id: true,
          status: true,
          paymentStatus: true,
          paymentMethod: true,
          items: { select: { variantId: true, quantity: true } },
          shipment: { select: { id: true, destLat: true, destLng: true } },
        },
      });
      if (!order) {
        throw ApiError.notFound('Order not found');
      }

      const current = order.status;
      if (current === next) {
        throw ApiError.unprocessable(`Order is already ${next}.`, { from: current, to: next });
      }
      if (!ALLOWED_TRANSITIONS[current].includes(next)) {
        throw ApiError.unprocessable(`Cannot move an order from ${current} to ${next}.`, {
          from: current,
          to: next,
          allowed: ALLOWED_TRANSITIONS[current],
        });
      }

      // Compare-and-set: the ONLY writer that still sees `current` wins the move.
      const moved = await tx.order.updateMany({
        where: { id: order.id, status: current },
        data: { status: next },
      });
      if (moved.count !== 1) {
        throw ApiError.conflict('This order changed since you loaded it. Refresh and try again.', {
          from: current,
          to: next,
        });
      }

      if (next === OrderStatus.CANCELLED) {
        // Restock every still-linked variant through the sanctioned ledger path.
        for (const it of order.items) {
          if (!it.variantId) continue; // variant was deleted (SetNull) — nothing to restock
          await recordInventoryChange(tx, {
            variantId: it.variantId,
            type: InventoryTxnType.CANCELLATION,
            quantityChanged: it.quantity, // positive → adds stock back, always succeeds
            orderId: order.id,
            adminId: adminId ?? null,
            reason: `Cancellation — ${orderNumber}`,
          });
          // Undo the lifetime sold count booked at sale time; never below zero.
          await tx.$executeRaw`UPDATE "ProductVariant" SET "soldQty" = GREATEST(0, "soldQty" - ${it.quantity}) WHERE "id" = ${it.variantId}`;
        }
        // Simulated refund: return money that was actually collected. COD that
        // was never paid simply stays PENDING (nothing to refund).
        if (order.paymentStatus === PaymentStatus.PAID) {
          await tx.order.update({ where: { id: order.id }, data: { paymentStatus: PaymentStatus.REFUNDED } });
          await tx.payment.updateMany({ where: { orderId: order.id }, data: { status: PaymentStatus.REFUNDED } });
        }
        if (order.shipment) {
          await tx.trackingHistory.create({
            data: { shipmentId: order.shipment.id, status: OrderStatus.CANCELLED, note: noteForStatus(OrderStatus.CANCELLED) },
          });
          // Fail the shipment, but DON'T move `current` — it stays where it was.
          await tx.shipment.update({
            where: { id: order.shipment.id },
            data: { status: ShipmentStatus.FAILED },
          });
        }
      } else {
        // Forward step. Advance the simulated shipment along its route: record a
        // tracking milestone (with the waypoint's coordinates) and move the
        // shipment's live position + lifecycle status. SIMULATED — not real GPS.
        if (order.shipment) {
          const dest = {
            lat: order.shipment.destLat ?? WAREHOUSE.lat,
            lng: order.shipment.destLng ?? WAREHOUSE.lng,
          };
          const wp = waypointForStatus(next, dest);
          await tx.trackingHistory.create({
            data: { shipmentId: order.shipment.id, status: next, note: noteForStatus(next), lat: wp.lat, lng: wp.lng },
          });
          await tx.shipment.update({
            where: { id: order.shipment.id },
            data: {
              status: orderToShipmentStatus(next),
              currentLat: wp.lat,
              currentLng: wp.lng,
              deliveredAt: next === OrderStatus.DELIVERED ? new Date() : undefined,
            },
          });
        }
        // Convenience: settle a COD order's payment when it's delivered.
        if (
          next === OrderStatus.DELIVERED &&
          order.paymentMethod === PaymentMethod.COD &&
          order.paymentStatus === PaymentStatus.PENDING
        ) {
          await tx.order.update({ where: { id: order.id }, data: { paymentStatus: PaymentStatus.PAID } });
          await tx.payment.updateMany({
            where: { orderId: order.id },
            data: { status: PaymentStatus.PAID, paidAt: new Date() },
          });
        }
      }

      return { orderId: order.id, from: current };
    },
    // Neon-generous timeouts (matches createOrder / adjustStock).
    { maxWait: 15_000, timeout: 30_000 },
  );

  // Best-effort audit outside the txn — never blocks or rolls back the change.
  await logAudit({
    adminId,
    action: 'order.status.change',
    entityType: 'Order',
    entityId: orderId,
    meta: { orderNumber, from, to: next },
  });

  return loadOrderDTOByNumber(orderNumber);
}
