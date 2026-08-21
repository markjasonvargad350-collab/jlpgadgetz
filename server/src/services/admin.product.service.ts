import { Prisma, InventoryTxnType, ProductStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { money } from '../utils/money';
import { slugify } from '../utils/slugify';
import { recordInventoryChange } from './inventory.service';
import { logAudit } from './audit.service';
import type {
  CreateProductInput,
  UpdateProductInput,
  VariantCreateInput,
  VariantUpdateInput,
  ImageInput,
  AdminProductQueryInput,
} from '../validators/admin.product.validator';

// ── Query shapes (typed via GetPayload so mapping stays fully checked) ──

const variantWithHistory = {
  _count: { select: { inventoryTransactions: true, orderItems: true } },
} satisfies Prisma.ProductVariantInclude;

const adminDetailInclude = {
  category: true,
  images: { orderBy: { position: 'asc' } },
  variants: {
    orderBy: [{ isActive: 'desc' }, { price: 'asc' }, { storage: 'asc' }],
    include: variantWithHistory,
  },
} satisfies Prisma.ProductInclude;

const adminListInclude = {
  category: true,
  images: { orderBy: { position: 'asc' }, take: 1 },
  variants: { select: { stock: true, isActive: true } },
  _count: { select: { variants: true } },
} satisfies Prisma.ProductInclude;

const variantDetailInclude = {
  product: { select: { id: true, name: true, slug: true } },
  ...variantWithHistory,
} satisfies Prisma.ProductVariantInclude;

type AdminDetailRow = Prisma.ProductGetPayload<{ include: typeof adminDetailInclude }>;
type AdminListRow = Prisma.ProductGetPayload<{ include: typeof adminListInclude }>;
type AdminVariantRow = Prisma.ProductVariantGetPayload<{ include: typeof variantDetailInclude }>;
type AdminDetailVariant = AdminDetailRow['variants'][number];

// ── Mappers (Decimal → number for display) ──

function mapVariant(v: AdminDetailVariant) {
  return {
    id: v.id,
    sku: v.sku,
    storage: v.storage,
    color: v.color,
    colorHex: v.colorHex,
    price: v.price.toNumber(),
    stock: v.stock,
    reservedStock: v.reservedStock,
    soldQty: v.soldQty,
    lowStockThreshold: v.lowStockThreshold,
    imageUrl: v.imageUrl,
    isActive: v.isActive,
    condition: v.condition,
    batteryHealth: v.batteryHealth,
    conditionNote: v.conditionNote,
    lowStock: v.stock > 0 && v.stock <= v.lowStockThreshold,
    // Presence of any ledger or sale row means the variant can't be hard-deleted.
    hasHistory: v._count.inventoryTransactions > 0 || v._count.orderItems > 0,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };
}

function toAdminDetail(p: AdminDetailRow) {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    model: p.model,
    description: p.description,
    highlights: p.highlights,
    basePrice: p.basePrice.toNumber(),
    discountPct: p.discountPct,
    status: p.status,
    installmentAvailable: p.installmentAvailable,
    installmentMinDownPct: p.installmentMinDownPct,
    isFeatured: p.isFeatured,
    isNewArrival: p.isNewArrival,
    isBestSeller: p.isBestSeller,
    isDeal: p.isDeal,
    isPreOwned: p.isPreOwned,
    releaseYear: p.releaseYear,
    categoryId: p.categoryId,
    categorySlug: p.category.slug,
    categoryName: p.category.name,
    images: p.images.map((i) => ({ id: i.id, url: i.url, alt: i.alt, position: i.position })),
    variants: p.variants.map(mapVariant),
    totalStock: p.variants.reduce((s, v) => s + v.stock, 0),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function toAdminCard(p: AdminListRow) {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    model: p.model,
    status: p.status,
    categoryName: p.category.name,
    basePrice: p.basePrice.toNumber(),
    discountPct: p.discountPct,
    isFeatured: p.isFeatured,
    isNewArrival: p.isNewArrival,
    isBestSeller: p.isBestSeller,
    isDeal: p.isDeal,
    isPreOwned: p.isPreOwned,
    releaseYear: p.releaseYear,
    image: p.images[0]?.url ?? null,
    variantCount: p._count.variants,
    activeVariantCount: p.variants.filter((v) => v.isActive).length,
    totalStock: p.variants.reduce((s, v) => s + v.stock, 0),
    updatedAt: p.updatedAt,
  };
}

function mapVariantDetail(v: AdminVariantRow) {
  return {
    id: v.id,
    sku: v.sku,
    storage: v.storage,
    color: v.color,
    colorHex: v.colorHex,
    price: v.price.toNumber(),
    stock: v.stock,
    reservedStock: v.reservedStock,
    soldQty: v.soldQty,
    lowStockThreshold: v.lowStockThreshold,
    imageUrl: v.imageUrl,
    isActive: v.isActive,
    condition: v.condition,
    batteryHealth: v.batteryHealth,
    conditionNote: v.conditionNote,
    lowStock: v.stock > 0 && v.stock <= v.lowStockThreshold,
    hasHistory: v._count.inventoryTransactions > 0 || v._count.orderItems > 0,
    product: v.product,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };
}

// ── Products ──

export async function listProductsAdmin(query: AdminProductQueryInput) {
  const where: Prisma.ProductWhereInput = {};
  if (query.status) where.status = query.status;
  if (query.category) where.category = { slug: query.category };
  if (query.q) {
    where.OR = [
      { name: { contains: query.q, mode: 'insensitive' } },
      { model: { contains: query.q, mode: 'insensitive' } },
      { variants: { some: { sku: { contains: query.q, mode: 'insensitive' } } } },
    ];
  }

  const orderBy: Prisma.ProductOrderByWithRelationInput =
    query.sort === 'name'
      ? { name: 'asc' }
      : query.sort === 'price_asc'
        ? { basePrice: 'asc' }
        : query.sort === 'price_desc'
          ? { basePrice: 'desc' }
          : { createdAt: 'desc' };

  const skip = (query.page - 1) * query.pageSize;
  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({ where, include: adminListInclude, orderBy, skip, take: query.pageSize }),
  ]);

  return {
    items: rows.map(toAdminCard),
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export async function getProductAdmin(id: string) {
  const product = await prisma.product.findUnique({ where: { id }, include: adminDetailInclude });
  if (!product) {
    throw ApiError.notFound('Product not found');
  }
  return toAdminDetail(product);
}

export async function createProduct(input: CreateProductInput, adminId?: string) {
  const slug = input.slug?.trim() || slugify(input.name);

  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        name: input.name,
        slug,
        brand: input.brand,
        model: input.model,
        description: input.description,
        highlights: input.highlights ?? [],
        basePrice: money(input.basePrice),
        discountPct: input.discountPct ?? 0,
        status: input.status ?? ProductStatus.DRAFT,
        installmentAvailable: input.installmentAvailable ?? false,
        installmentMinDownPct: input.installmentMinDownPct ?? 0,
        isFeatured: input.isFeatured ?? false,
        isNewArrival: input.isNewArrival ?? false,
        isBestSeller: input.isBestSeller ?? false,
        isDeal: input.isDeal ?? false,
        isPreOwned: input.isPreOwned ?? false,
        releaseYear: input.releaseYear,
        categoryId: input.categoryId,
        images: input.images?.length
          ? { create: input.images.map((im, i) => ({ url: im.url, alt: im.alt, position: im.position ?? i })) }
          : undefined,
      },
    });

    // Variants are created at stock 0, then any opening stock is booked through
    // the ledger so on-hand stock and InventoryTransaction history stay in sync.
    for (const v of input.variants ?? []) {
      const variant = await tx.productVariant.create({
        data: {
          productId: created.id,
          sku: v.sku,
          storage: v.storage,
          color: v.color,
          colorHex: v.colorHex,
          price: money(v.price),
          stock: 0,
          lowStockThreshold: v.lowStockThreshold ?? 5,
          imageUrl: v.imageUrl,
          isActive: v.isActive ?? true,
          condition: v.condition,
          batteryHealth: v.batteryHealth,
          conditionNote: v.conditionNote,
        },
      });
      if (v.initialStock && v.initialStock > 0) {
        await recordInventoryChange(tx, {
          variantId: variant.id,
          type: InventoryTxnType.RESTOCK,
          quantityChanged: v.initialStock,
          reason: 'Initial stock',
          adminId: adminId ?? null,
        });
      }
    }

    return created;
  });

  await logAudit({
    adminId,
    action: 'product.create',
    entityType: 'Product',
    entityId: product.id,
    meta: { slug, name: input.name },
  });

  return getProductAdmin(product.id);
}

export async function updateProduct(id: string, input: UpdateProductInput, adminId?: string) {
  const existing = await prisma.product.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    throw ApiError.notFound('Product not found');
  }

  const data: Prisma.ProductUncheckedUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.slug !== undefined) data.slug = input.slug;
  if (input.brand !== undefined) data.brand = input.brand;
  if (input.model !== undefined) data.model = input.model;
  if (input.description !== undefined) data.description = input.description;
  if (input.highlights !== undefined) data.highlights = input.highlights;
  if (input.basePrice !== undefined) data.basePrice = money(input.basePrice);
  if (input.discountPct !== undefined) data.discountPct = input.discountPct;
  if (input.status !== undefined) data.status = input.status;
  if (input.installmentAvailable !== undefined) data.installmentAvailable = input.installmentAvailable;
  if (input.installmentMinDownPct !== undefined) data.installmentMinDownPct = input.installmentMinDownPct;
  if (input.isFeatured !== undefined) data.isFeatured = input.isFeatured;
  if (input.isNewArrival !== undefined) data.isNewArrival = input.isNewArrival;
  if (input.isBestSeller !== undefined) data.isBestSeller = input.isBestSeller;
  if (input.isDeal !== undefined) data.isDeal = input.isDeal;
  if (input.isPreOwned !== undefined) data.isPreOwned = input.isPreOwned;
  if (input.releaseYear !== undefined) data.releaseYear = input.releaseYear;
  if (input.categoryId !== undefined) data.categoryId = input.categoryId;

  await prisma.product.update({ where: { id }, data });

  await logAudit({
    adminId,
    action: 'product.update',
    entityType: 'Product',
    entityId: id,
    meta: { fields: Object.keys(input) },
  });

  return getProductAdmin(id);
}

export async function deleteProduct(id: string, adminId?: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: { variants: { include: variantWithHistory } },
  });
  if (!product) {
    throw ApiError.notFound('Product not found');
  }

  // Never destroy sales/inventory history. If any variant has a ledger row or
  // an order item, refuse the hard delete and steer the admin to archiving.
  const hasHistory = product.variants.some(
    (v) => v._count.inventoryTransactions > 0 || v._count.orderItems > 0,
  );
  if (hasHistory) {
    throw ApiError.conflict(
      'This product has inventory or sales history and cannot be deleted. Archive it instead.',
      { productId: id },
    );
  }

  // Safe: only images + history-free variants remain, both cascade from Product.
  await prisma.product.delete({ where: { id } });

  await logAudit({
    adminId,
    action: 'product.delete',
    entityType: 'Product',
    entityId: id,
    meta: { slug: product.slug, name: product.name },
  });

  return { id, deleted: true };
}

// ── Variants ──

export async function getVariant(id: string) {
  const variant = await prisma.productVariant.findUnique({ where: { id }, include: variantDetailInclude });
  if (!variant) {
    throw ApiError.notFound('Variant not found');
  }
  return mapVariantDetail(variant);
}

export async function addVariant(productId: string, input: VariantCreateInput, adminId?: string) {
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) {
    throw ApiError.notFound('Product not found');
  }

  const variant = await prisma.$transaction(async (tx) => {
    const created = await tx.productVariant.create({
      data: {
        productId,
        sku: input.sku,
        storage: input.storage,
        color: input.color,
        colorHex: input.colorHex,
        price: money(input.price),
        stock: 0,
        lowStockThreshold: input.lowStockThreshold ?? 5,
        imageUrl: input.imageUrl,
        isActive: input.isActive ?? true,
        condition: input.condition,
        batteryHealth: input.batteryHealth,
        conditionNote: input.conditionNote,
      },
    });
    if (input.initialStock && input.initialStock > 0) {
      await recordInventoryChange(tx, {
        variantId: created.id,
        type: InventoryTxnType.RESTOCK,
        quantityChanged: input.initialStock,
        reason: 'Initial stock',
        adminId: adminId ?? null,
      });
    }
    return created;
  });

  await logAudit({
    adminId,
    action: 'variant.create',
    entityType: 'ProductVariant',
    entityId: variant.id,
    meta: { sku: input.sku, productId },
  });

  return getVariant(variant.id);
}

export async function updateVariant(id: string, input: VariantUpdateInput, adminId?: string) {
  const existing = await prisma.productVariant.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    throw ApiError.notFound('Variant not found');
  }

  // Stock is intentionally NOT editable here — it only moves via the inventory
  // ledger (recordInventoryChange), never by a direct field write.
  const data: Prisma.ProductVariantUncheckedUpdateInput = {};
  if (input.sku !== undefined) data.sku = input.sku;
  if (input.storage !== undefined) data.storage = input.storage;
  if (input.color !== undefined) data.color = input.color;
  if (input.colorHex !== undefined) data.colorHex = input.colorHex;
  if (input.price !== undefined) data.price = money(input.price);
  if (input.lowStockThreshold !== undefined) data.lowStockThreshold = input.lowStockThreshold;
  if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (input.condition !== undefined) data.condition = input.condition;
  if (input.batteryHealth !== undefined) data.batteryHealth = input.batteryHealth;
  if (input.conditionNote !== undefined) data.conditionNote = input.conditionNote;

  await prisma.productVariant.update({ where: { id }, data });

  await logAudit({
    adminId,
    action: 'variant.update',
    entityType: 'ProductVariant',
    entityId: id,
    meta: { fields: Object.keys(input) },
  });

  return getVariant(id);
}

// ── Images ──

export async function addImage(productId: string, input: ImageInput, adminId?: string) {
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) {
    throw ApiError.notFound('Product not found');
  }

  const position =
    input.position ??
    (await prisma.productImage.count({ where: { productId } })); // append to the end by default

  const image = await prisma.productImage.create({
    data: { productId, url: input.url, alt: input.alt, position },
  });

  await logAudit({
    adminId,
    action: 'image.create',
    entityType: 'ProductImage',
    entityId: image.id,
    meta: { productId },
  });

  return { id: image.id, url: image.url, alt: image.alt, position: image.position };
}

export async function deleteImage(imageId: string, adminId?: string) {
  const image = await prisma.productImage.findUnique({ where: { id: imageId }, select: { id: true, productId: true } });
  if (!image) {
    throw ApiError.notFound('Image not found');
  }

  await prisma.productImage.delete({ where: { id: imageId } });

  await logAudit({
    adminId,
    action: 'image.delete',
    entityType: 'ProductImage',
    entityId: imageId,
    meta: { productId: image.productId },
  });

  return { id: imageId, deleted: true };
}
