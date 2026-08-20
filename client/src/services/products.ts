import { http } from './http';
import type { Paginated, ProductCard, ProductDetail, ProductListParams } from '../types/api';

/** GET /api/products — search / filter / sort / paginate the ACTIVE catalog. */
export async function listProducts(params: ProductListParams = {}): Promise<Paginated<ProductCard>> {
  const { data } = await http.get<Paginated<ProductCard>>('/products', { params });
  return data;
}

/** GET /api/products/:idOrSlug — full product detail (images + active variants). */
export async function getProduct(idOrSlug: string): Promise<ProductDetail> {
  const { data } = await http.get<{ product: ProductDetail }>(`/products/${encodeURIComponent(idOrSlug)}`);
  return data.product;
}
