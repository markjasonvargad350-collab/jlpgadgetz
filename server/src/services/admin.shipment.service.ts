import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { logAudit } from './audit.service';
import { loadOrderDTOByNumber, type OrderDTO } from './order.service';
import type { UpdateShipmentBody } from '../validators/admin.shipment.validator';

/**
 * Update an ADMIN-editable shipment field (courier / tracking code / ETA). The
 * shipment's live status + coordinates are owned by the fulfillment
 * state-machine and are deliberately NOT touched here. Undefined patch fields
 * are skipped by Prisma, so this is a true partial update. Returns the full,
 * refreshed order DTO.
 */
export async function updateShipment(
  orderNumber: string,
  patch: UpdateShipmentBody,
  adminId?: string,
): Promise<OrderDTO> {
  const shipment = await prisma.shipment.findFirst({
    where: { order: { orderNumber } },
    select: { id: true },
  });
  if (!shipment) {
    throw ApiError.notFound('No shipment found for this order.');
  }

  await prisma.shipment.update({
    where: { id: shipment.id },
    data: {
      courier: patch.courier,
      trackingCode: patch.trackingCode,
      estimatedArrival: patch.estimatedArrival,
    },
  });

  await logAudit({
    adminId,
    action: 'shipment.update',
    entityType: 'Shipment',
    entityId: shipment.id,
    meta: { orderNumber, fields: Object.keys(patch) },
  });

  return loadOrderDTOByNumber(orderNumber);
}
