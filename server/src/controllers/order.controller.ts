import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as orderService from '../services/order.service';
import type { CreateOrderBody } from '../validators/order.validator';

/** POST /api/orders — create a guest order (public). Body validated upstream. */
export const create = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as CreateOrderBody;
  const order = await orderService.createOrder(body);
  res.status(201).json({ order });
});

/**
 * GET /api/orders/:orderNumber?email=... — guest order lookup. Email must match
 * the order (enforced in the service) or a 404 is returned.
 */
export const getByNumber = asyncHandler(async (req: Request, res: Response) => {
  const { orderNumber } = req.params as { orderNumber: string };
  const { email } = req.query as unknown as { email: string };
  const order = await orderService.getOrderForGuest(orderNumber, email);
  res.json({ order });
});
