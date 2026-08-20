import type { Request, Response } from 'express';
import { OrderStatus } from '@prisma/client';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import * as svc from '../services/admin.order.service';
import type { AdminOrderListQuery, UpdateOrderStatusBody } from '../validators/admin.order.validator';

/** GET /api/admin/orders — order list (search/filter/sort/paginate). */
export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await svc.listOrders(req.query as unknown as AdminOrderListQuery);
  res.json(result);
});

/** GET /api/admin/orders/:orderNumber — full order detail (session-gated). */
export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const { orderNumber } = req.params as { orderNumber: string };
  const order = await svc.getOrderByNumberAdmin(orderNumber);
  res.json({ order });
});

/**
 * PATCH /api/admin/orders/:orderNumber/status — advance or cancel fulfillment.
 * Any authenticated admin may advance status; **cancellation** restocks + refunds
 * (destructive/financial) so it is ADMIN-only, gated here because the rule is
 * conditional on the target status.
 */
export const updateStatus = asyncHandler(async (req: Request, res: Response) => {
  const { orderNumber } = req.params as { orderNumber: string };
  const { status } = req.body as UpdateOrderStatusBody;

  if (status === OrderStatus.CANCELLED && req.admin?.role !== 'ADMIN') {
    throw ApiError.forbidden('Only an admin can cancel an order.');
  }

  const order = await svc.updateOrderStatus(orderNumber, status, req.admin?.sub);
  res.json({ order });
});
