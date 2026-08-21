import { http } from './http';
import type { CreateTradeInRequest, TradeInDTO } from '../types/tradeIn';

/**
 * POST /api/trade-ins — submit a trade-in application (guest, no account). The
 * server snapshots the customer's self-reported device details and returns the
 * created record with its reference (TRD-YYYYMMDD-####).
 *
 * No valuation comes back: JLP staff inspect the device and price it in the
 * back-office, so `quotedValue`/`finalValue` are null on submission.
 */
export async function createTradeIn(req: CreateTradeInRequest): Promise<TradeInDTO> {
  const { data } = await http.post<{ tradeIn: TradeInDTO }>('/trade-ins', req);
  return data.tradeIn;
}
