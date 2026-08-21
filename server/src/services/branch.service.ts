import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';

/**
 * Public branch DTO + shared helpers. Branches are lightweight, customer-
 * selectable locations (a preferred/pickup point and the contact for trade-ins
 * and installments). The catalog + stock stay GLOBAL — a branch never scopes
 * inventory. Only Passi carries a real street address; the others expose
 * city/province only (we don't invent addresses we don't have).
 */

const publicBranchSelect = {
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
  isDefault: true,
} satisfies Prisma.BranchSelect;

type PublicBranchRow = Prisma.BranchGetPayload<{ select: typeof publicBranchSelect }>;

export function toPublicBranch(b: PublicBranchRow) {
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
    isDefault: b.isDefault,
  };
}

/** Active branches for storefront pickers + the About page, in display order. */
export async function listActiveBranches() {
  const rows = await prisma.branch.findMany({
    where: { isActive: true },
    orderBy: [{ position: 'asc' }, { name: 'asc' }],
    select: publicBranchSelect,
  });
  return rows.map(toPublicBranch);
}

/**
 * Assert a branch id refers to a selectable (active) branch, else 422. Used by
 * checkout / trade-in / installment when the customer picks a branch. A branch
 * being deactivated mid-flow is harmless (branchId is informational), so this
 * runs outside the caller's critical transaction.
 */
export async function assertBranchSelectable(branchId: string): Promise<void> {
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, isActive: true },
    select: { id: true },
  });
  if (!branch) {
    throw ApiError.unprocessable('The selected branch is not available.', { branchId });
  }
}
