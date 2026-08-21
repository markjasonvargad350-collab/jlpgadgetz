import { http } from './http';
import type { Paginated } from '../types/api';
import type { AdminTradeInCard, AdminTradeInParams, TradeInUpdateInput } from '../types/admin';
import type { TradeInDTO } from '../types/tradeIn';

/**
 * Admin trade-in services. Trade-ins are staff-managed: the customer applies
 * online and a staff member inspects the device and enters the valuation here.
 * No offer is ever computed by the app.
 */

/** GET /api/admin/trade-ins — list requests (status filter + search). */
export async function listAdminTradeIns(
  params: AdminTradeInParams = {},
): Promise<Paginated<AdminTradeInCard>> {
  const { data } = await http.get<Paginated<AdminTradeInCard>>('/admin/trade-ins', { params });
  return data;
}

/** GET /api/admin/trade-ins/:id — full record (device details + valuation). */
export async function getAdminTradeIn(id: string): Promise<TradeInDTO> {
  const { data } = await http.get<{ tradeIn: TradeInDTO }>(`/admin/trade-ins/${encodeURIComponent(id)}`);
  return data.tradeIn;
}

/** PATCH /api/admin/trade-ins/:id — advance status and/or record the valuation. */
export async function updateTradeIn(id: string, input: TradeInUpdateInput): Promise<TradeInDTO> {
  const { data } = await http.patch<{ tradeIn: TradeInDTO }>(
    `/admin/trade-ins/${encodeURIComponent(id)}`,
    input,
  );
  return data.tradeIn;
}
