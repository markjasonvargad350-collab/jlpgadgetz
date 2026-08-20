import { http } from './http';
import type { Category } from '../types/api';

/** GET /api/categories — active categories with active-product counts. */
export async function listCategories(): Promise<Category[]> {
  const { data } = await http.get<{ categories: Category[] }>('/categories');
  return data.categories;
}
