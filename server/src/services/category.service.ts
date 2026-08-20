import { ProductStatus } from '@prisma/client';
import { prisma } from '../config/prisma';

export interface CategoryListItem {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  position: number;
  productCount: number;
}

/**
 * Active categories in display order, each with a count of its ACTIVE products
 * (so the storefront can show "iPhone (10)" and hide empty categories).
 */
export async function listCategories(): Promise<CategoryListItem[]> {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { position: 'asc' },
    include: {
      _count: { select: { products: { where: { status: ProductStatus.ACTIVE } } } },
    },
  });

  return categories.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description,
    imageUrl: c.imageUrl,
    position: c.position,
    productCount: c._count.products,
  }));
}
