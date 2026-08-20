import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as svc from '../services/admin.shipment.service';
import type { UpdateShipmentBody } from '../validators/admin.shipment.validator';

/** PATCH /api/admin/shipments/:orderNumber — edit courier / tracking code / ETA (ADMIN-only). */
export const update = asyncHandler(async (req: Request, res: Response) => {
  const { orderNumber } = req.params as { orderNumber: string };
  const patch = req.body as UpdateShipmentBody;
  const order = await svc.updateShipment(orderNumber, patch, req.admin?.sub);
  res.json({ order });
});
