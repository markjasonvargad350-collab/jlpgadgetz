import { http } from './http';
import type { Paginated } from '../types/api';
import type { AdminOrderCard, AdminOrderParams } from '../types/admin';
import type { OrderDTO, OrderStatus } from '../types/order';

/**
 * Admin order services: the paginated card list, full detail (session-gated — no
 * email guard, unlike the guest lookup), and the fulfillment status transition.
 * List returns the bare `{items,…}` envelope; detail + update return `{order}`.
 */

/** GET /api/admin/orders — paginated order cards with server-side filters. */
export async function listOrders(params: AdminOrderParams = {}): Promise<Paginated<AdminOrderCard>> {
  const { data } = await http.get<Paginated<AdminOrderCard>>('/admin/orders', { params });
  return data;
}

/** GET /api/admin/orders/:orderNumber — full order detail (with shipment history). */
export async function getOrder(orderNumber: string): Promise<OrderDTO> {
  const { data } = await http.get<{ order: OrderDTO }>(`/admin/orders/${encodeURIComponent(orderNumber)}`);
  return data.order;
}

/**
 * PATCH /api/admin/orders/:orderNumber/status — advance or cancel an order. The
 * server validates the transition (single-step forward, or cancel-from-any); an
 * illegal move is a 422 and a concurrent race is a 409. Cancellation is
 * ADMIN-only (403 for STAFF) and restocks + refunds inside a transaction.
 */
export async function updateOrderStatus(orderNumber: string, status: OrderStatus): Promise<OrderDTO> {
  const { data } = await http.patch<{ order: OrderDTO }>(
    `/admin/orders/${encodeURIComponent(orderNumber)}/status`,
    { status },
  );
  return data.order;
}
