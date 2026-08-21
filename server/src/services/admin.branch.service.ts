import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { slugify } from '../utils/slugify';
import { logAudit } from './audit.service';
import type {
  CreateBranchInput,
  UpdateBranchInput,
  AdminBranchQueryInput,
} from '../validators/admin.branch.validator';

// ── Query shapes ──

const adminBranchSelect = {
  id: true,
  name: true,
  slug: true,
  city: true,
  province: true,
  addressLine: true,
  phone: true,
  email: true,
  hours: true,
  lat: true,
  lng: true,
  position: true,
  isActive: true,
  isDefault: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { orders: true, tradeIns: true, installmentPlans: true } },
} satisfies Prisma.BranchSelect;

type AdminBranchRow = Prisma.BranchGetPayload<{ select: typeof adminBranchSelect }>;

function toAdminBranch(b: AdminBranchRow) {
  const references = b._count.orders + b._count.tradeIns + b._count.installmentPlans;
  return {
    id: b.id,
    name: b.name,
    slug: b.slug,
    city: b.city,
    province: b.province,
    addressLine: b.addressLine,
    phone: b.phone,
    email: b.email,
    hours: b.hours,
    lat: b.lat,
    lng: b.lng,
    position: b.position,
    isActive: b.isActive,
    isDefault: b.isDefault,
    orderCount: b._count.orders,
    tradeInCount: b._count.tradeIns,
    installmentCount: b._count.installmentPlans,
    // Any reference blocks a hard delete — the admin deactivates instead.
    canDelete: references === 0,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}

// ── Read ──

export async function listBranchesAdmin(query: AdminBranchQueryInput) {
  const where: Prisma.BranchWhereInput = {};
  if (query.active !== undefined) where.isActive = query.active;
  if (query.q) {
    where.OR = [
      { name: { contains: query.q, mode: 'insensitive' } },
      { city: { contains: query.q, mode: 'insensitive' } },
      { province: { contains: query.q, mode: 'insensitive' } },
    ];
  }

  const skip = (query.page - 1) * query.pageSize;
  const [total, rows] = await Promise.all([
    prisma.branch.count({ where }),
    prisma.branch.findMany({
      where,
      select: adminBranchSelect,
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      skip,
      take: query.pageSize,
    }),
  ]);

  return {
    items: rows.map(toAdminBranch),
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export async function getBranchAdmin(id: string) {
  const branch = await prisma.branch.findUnique({ where: { id }, select: adminBranchSelect });
  if (!branch) {
    throw ApiError.notFound('Branch not found');
  }
  return toAdminBranch(branch);
}

// ── Write ──

export async function createBranch(input: CreateBranchInput, adminId?: string) {
  const slug = input.slug?.trim() || slugify(input.name);

  const branch = await prisma.$transaction(async (tx) => {
    // At most one default branch — clear the flag elsewhere before setting it here.
    if (input.isDefault) {
      await tx.branch.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    }
    return tx.branch.create({
      data: {
        name: input.name,
        slug,
        city: input.city,
        province: input.province,
        addressLine: input.addressLine,
        phone: input.phone,
        email: input.email,
        hours: input.hours,
        lat: input.lat,
        lng: input.lng,
        position: input.position ?? 0,
        isActive: input.isActive ?? true,
        isDefault: input.isDefault ?? false,
      },
      select: { id: true },
    });
  });

  await logAudit({
    adminId,
    action: 'branch.create',
    entityType: 'Branch',
    entityId: branch.id,
    meta: { slug, name: input.name },
  });

  return getBranchAdmin(branch.id);
}

export async function updateBranch(id: string, input: UpdateBranchInput, adminId?: string) {
  const existing = await prisma.branch.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    throw ApiError.notFound('Branch not found');
  }

  const data: Prisma.BranchUncheckedUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.slug !== undefined) data.slug = input.slug;
  if (input.city !== undefined) data.city = input.city;
  if (input.province !== undefined) data.province = input.province;
  if (input.addressLine !== undefined) data.addressLine = input.addressLine;
  if (input.phone !== undefined) data.phone = input.phone;
  if (input.email !== undefined) data.email = input.email;
  if (input.hours !== undefined) data.hours = input.hours;
  if (input.lat !== undefined) data.lat = input.lat;
  if (input.lng !== undefined) data.lng = input.lng;
  if (input.position !== undefined) data.position = input.position;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (input.isDefault !== undefined) data.isDefault = input.isDefault;

  await prisma.$transaction(async (tx) => {
    if (input.isDefault === true) {
      await tx.branch.updateMany({
        where: { isDefault: true, NOT: { id } },
        data: { isDefault: false },
      });
    }
    await tx.branch.update({ where: { id }, data });
  });

  await logAudit({
    adminId,
    action: 'branch.update',
    entityType: 'Branch',
    entityId: id,
    meta: { fields: Object.keys(input) },
  });

  return getBranchAdmin(id);
}

export async function deleteBranch(id: string, adminId?: string) {
  const branch = await prisma.branch.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      _count: { select: { orders: true, tradeIns: true, installmentPlans: true } },
    },
  });
  if (!branch) {
    throw ApiError.notFound('Branch not found');
  }

  // Never orphan history. A referenced branch is deactivated, not destroyed
  // (orders/trade-ins/installments keep pointing at it for the record).
  const references = branch._count.orders + branch._count.tradeIns + branch._count.installmentPlans;
  if (references > 0) {
    throw ApiError.conflict(
      'This branch has orders, trade-ins, or installment plans and cannot be deleted. Deactivate it instead.',
      { branchId: id, references },
    );
  }

  await prisma.branch.delete({ where: { id } });

  await logAudit({
    adminId,
    action: 'branch.delete',
    entityType: 'Branch',
    entityId: id,
    meta: { slug: branch.slug, name: branch.name },
  });

  return { id, deleted: true };
}
