import { http } from './http';
import type { Branch } from '../types/api';

/**
 * GET /api/branches — active JLP branches in display order, for the branch
 * pickers and the About page. Public + briefly cacheable server-side.
 */
export async function listBranches(): Promise<Branch[]> {
  const { data } = await http.get<{ branches: Branch[] }>('/branches');
  return data.branches;
}
