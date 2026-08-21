import { http } from './http';
import type { Paginated } from '../types/api';
import type {
  AdminBranch,
  AdminBranchParams,
  BranchCreateInput,
  BranchUpdateInput,
  DeleteResult,
} from '../types/admin';

/**
 * Admin branch services. Branches are informational — the catalog and stock stay
 * global — so nothing here touches prices or availability. Envelopes match the
 * server exactly (list → bare `{items,…}`, single → `{branch}`).
 */

/** GET /api/admin/branches — all branches, active and inactive. */
export async function listAdminBranches(params: AdminBranchParams = {}): Promise<Paginated<AdminBranch>> {
  const { data } = await http.get<Paginated<AdminBranch>>('/admin/branches', { params });
  return data;
}

/** GET /api/admin/branches/:id. */
export async function getAdminBranch(id: string): Promise<AdminBranch> {
  const { data } = await http.get<{ branch: AdminBranch }>(`/admin/branches/${encodeURIComponent(id)}`);
  return data.branch;
}

/** POST /api/admin/branches. */
export async function createBranch(input: BranchCreateInput): Promise<AdminBranch> {
  const { data } = await http.post<{ branch: AdminBranch }>('/admin/branches', input);
  return data.branch;
}

/** PATCH /api/admin/branches/:id. */
export async function updateBranch(id: string, input: BranchUpdateInput): Promise<AdminBranch> {
  const { data } = await http.patch<{ branch: AdminBranch }>(
    `/admin/branches/${encodeURIComponent(id)}`,
    input,
  );
  return data.branch;
}

/** DELETE /api/admin/branches/:id (ADMIN only; 409 once anything references it). */
export async function deleteBranch(id: string): Promise<DeleteResult> {
  const { data } = await http.delete<DeleteResult>(`/admin/branches/${encodeURIComponent(id)}`);
  return data;
}
