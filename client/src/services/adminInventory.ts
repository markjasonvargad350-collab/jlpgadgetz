import { http } from './http';
import type { Paginated } from '../types/api';
import type {
  InventoryStats,
  InventoryRow,
  InventoryParams,
  InventoryTxn,
  TransactionParams,
  AdjustInput,
  AdjustResult,
} from '../types/admin';

/**
 * Admin inventory services: dashboard stats, the variant-centric stock list, the
 * ledger, and manual adjustments. List/ledger return the bare `{items,…}`
 * envelope; adjust returns `{variant, transaction}`.
 */

/** GET /api/admin/inventory/stats — dashboard counts (in/low/out, units, value). */
export async function getInventoryStats(): Promise<InventoryStats> {
  const { data } = await http.get<InventoryStats>('/admin/inventory/stats');
  return data;
}

/** GET /api/admin/inventory — variant-centric stock list. */
export async function listInventory(params: InventoryParams = {}): Promise<Paginated<InventoryRow>> {
  const { data } = await http.get<Paginated<InventoryRow>>('/admin/inventory', { params });
  return data;
}

/** GET /api/admin/inventory/transactions — the inventory ledger (newest first). */
export async function listTransactions(params: TransactionParams = {}): Promise<Paginated<InventoryTxn>> {
  const { data } = await http.get<Paginated<InventoryTxn>>('/admin/inventory/transactions', { params });
  return data;
}

/** POST /api/admin/inventory/adjust — manual stock movement (ADMIN only). */
export async function adjustStock(input: AdjustInput): Promise<AdjustResult> {
  const { data } = await http.post<AdjustResult>('/admin/inventory/adjust', input);
  return data;
}
