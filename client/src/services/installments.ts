import { http } from './http';
import type {
  CreateInstallmentRequest,
  InstallmentDTO,
  InstallmentQuote,
  InstallmentQuoteParams,
} from '../types/installment';

/**
 * GET /api/installments/quote — the AUTHORITATIVE schedule preview. The server
 * re-reads the variant price from the database and computes principal, monthly
 * and every row; nothing is persisted. Always render what this returns rather
 * than a locally computed figure.
 *
 * Throws an ApiError: 404 if the option isn't buyable, 422 if the product isn't
 * installment-enabled or the down payment is out of range.
 */
export async function quoteInstallment(params: InstallmentQuoteParams): Promise<InstallmentQuote> {
  const { data } = await http.get<{ quote: InstallmentQuote }>('/installments/quote', { params });
  return data.quote;
}

/**
 * POST /api/installments — apply for an installment plan (guest, no account).
 * The client sends only the variant, term and down payment; the server
 * re-derives all money from the stored price and creates the plan (PENDING)
 * plus its full payment schedule in one transaction. Staff review it next.
 */
export async function createInstallment(req: CreateInstallmentRequest): Promise<InstallmentDTO> {
  const { data } = await http.post<{ installment: InstallmentDTO }>('/installments', req);
  return data.installment;
}
