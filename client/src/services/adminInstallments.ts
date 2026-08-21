import { http } from './http';
import type { Paginated } from '../types/api';
import type {
  AdminInstallmentCard,
  AdminInstallmentParams,
  InstallmentStatusUpdateInput,
  RecordPaymentInput,
} from '../types/admin';
import type { InstallmentDTO } from '../types/installment';

/**
 * Admin installment services. Every peso figure comes from the server, which
 * derived it from the stored variant price at apply time. Recording a payment is
 * additive — schedule rows are updated, never deleted.
 */

/** GET /api/admin/installments — list plans (status filter + search). */
export async function listAdminInstallments(
  params: AdminInstallmentParams = {},
): Promise<Paginated<AdminInstallmentCard>> {
  const { data } = await http.get<Paginated<AdminInstallmentCard>>('/admin/installments', { params });
  return data;
}

/** GET /api/admin/installments/:id — full plan with its payment schedule. */
export async function getAdminInstallment(id: string): Promise<InstallmentDTO> {
  const { data } = await http.get<{ installment: InstallmentDTO }>(
    `/admin/installments/${encodeURIComponent(id)}`,
  );
  return data.installment;
}

/** PATCH /api/admin/installments/:id — advance the plan's status. */
export async function updateInstallmentStatus(
  id: string,
  input: InstallmentStatusUpdateInput,
): Promise<InstallmentDTO> {
  const { data } = await http.patch<{ installment: InstallmentDTO }>(
    `/admin/installments/${encodeURIComponent(id)}`,
    input,
  );
  return data.installment;
}

/**
 * POST /api/admin/installments/:id/payments/:paymentId — record a payment against
 * one schedule row. Returns the whole refreshed plan so totals and status stay in
 * sync. The server rejects any amount above the row's remaining balance.
 */
export async function recordInstallmentPayment(
  id: string,
  paymentId: string,
  input: RecordPaymentInput,
): Promise<InstallmentDTO> {
  const { data } = await http.post<{ installment: InstallmentDTO }>(
    `/admin/installments/${encodeURIComponent(id)}/payments/${encodeURIComponent(paymentId)}`,
    input,
  );
  return data.installment;
}
