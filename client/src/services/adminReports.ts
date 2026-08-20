import { http } from './http';
import type { ReportSummary } from '../types/admin';

/** GET /api/admin/reports/summary — KPIs, breakdowns, daily revenue, top products. */
export async function getReportSummary(): Promise<ReportSummary> {
  const { data } = await http.get<ReportSummary>('/admin/reports/summary');
  return data;
}
