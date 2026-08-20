import { http } from './http';
import type { Paginated } from '../types/api';
import type {
  AdminProductCard,
  AdminProductDetail,
  AdminProductParams,
  AdminImage,
  AdminVariantDetail,
  ProductCreateInput,
  ProductUpdateInput,
  VariantCreateInput,
  VariantUpdateInput,
  ImageInput,
  DeleteResult,
} from '../types/admin';

/**
 * Admin product/variant/image services. Each call unwraps the exact envelope
 * key the server uses (list → bare `{items,…}`, single resource → `{product}` /
 * `{variant}` / `{image}`). Errors surface as ApiError via the http interceptor.
 */

// ── Products ──────────────────────────────────────────────────────────────────

/** GET /api/admin/products — full catalog (all statuses). */
export async function listAdminProducts(params: AdminProductParams = {}): Promise<Paginated<AdminProductCard>> {
  const { data } = await http.get<Paginated<AdminProductCard>>('/admin/products', { params });
  return data;
}

/** GET /api/admin/products/:id — full detail (images + variants). */
export async function getAdminProduct(id: string): Promise<AdminProductDetail> {
  const { data } = await http.get<{ product: AdminProductDetail }>(`/admin/products/${encodeURIComponent(id)}`);
  return data.product;
}

/** POST /api/admin/products — create with optional images + variants. */
export async function createProduct(input: ProductCreateInput): Promise<AdminProductDetail> {
  const { data } = await http.post<{ product: AdminProductDetail }>('/admin/products', input);
  return data.product;
}

/** PATCH /api/admin/products/:id. */
export async function updateProduct(id: string, input: ProductUpdateInput): Promise<AdminProductDetail> {
  const { data } = await http.patch<{ product: AdminProductDetail }>(
    `/admin/products/${encodeURIComponent(id)}`,
    input,
  );
  return data.product;
}

/** DELETE /api/admin/products/:id (ADMIN only; 409 if it has history). */
export async function deleteProduct(id: string): Promise<DeleteResult> {
  const { data } = await http.delete<DeleteResult>(`/admin/products/${encodeURIComponent(id)}`);
  return data;
}

// ── Variants ────────────────────────────────────────────────────────────────

/** POST /api/admin/products/:id/variants. */
export async function addVariant(productId: string, input: VariantCreateInput): Promise<AdminVariantDetail> {
  const { data } = await http.post<{ variant: AdminVariantDetail }>(
    `/admin/products/${encodeURIComponent(productId)}/variants`,
    input,
  );
  return data.variant;
}

/** PATCH /api/admin/variants/:id (non-stock fields only). */
export async function updateVariant(id: string, input: VariantUpdateInput): Promise<AdminVariantDetail> {
  const { data } = await http.patch<{ variant: AdminVariantDetail }>(
    `/admin/variants/${encodeURIComponent(id)}`,
    input,
  );
  return data.variant;
}

// ── Images ────────────────────────────────────────────────────────────────

/** POST /api/admin/products/:id/images. */
export async function addImage(productId: string, input: ImageInput): Promise<AdminImage> {
  const { data } = await http.post<{ image: AdminImage }>(
    `/admin/products/${encodeURIComponent(productId)}/images`,
    input,
  );
  return data.image;
}

/** DELETE /api/admin/images/:imageId. */
export async function deleteImage(imageId: string): Promise<DeleteResult> {
  const { data } = await http.delete<DeleteResult>(`/admin/images/${encodeURIComponent(imageId)}`);
  return data;
}
