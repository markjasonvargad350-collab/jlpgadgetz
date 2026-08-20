import { http } from './http';
import type { CreateOrderRequest, OrderDTO } from '../types/order';

/**
 * POST /api/orders — place a guest order. The server re-validates stock and
 * re-derives all money inside a DB transaction, then returns the created order.
 * A 409 ApiError (code 'CONFLICT') with stock details is thrown if an item ran
 * out between adding to cart and checkout.
 */
export async function createOrder(req: CreateOrderRequest): Promise<OrderDTO> {
  const { data } = await http.post<{ order: OrderDTO }>('/orders', req);
  return data.order;
}

/**
 * GET /api/orders/:orderNumber?email=... — guest order lookup. The email must
 * match the order or the server returns 404 (it never confirms a number exists
 * to the wrong email).
 */
export async function getOrder(orderNumber: string, email: string): Promise<OrderDTO> {
  const { data } = await http.get<{ order: OrderDTO }>(
    `/orders/${encodeURIComponent(orderNumber)}`,
    { params: { email } },
  );
  return data.order;
}
