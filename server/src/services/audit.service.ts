import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { logger } from '../utils/logger';

export interface AuditEntry {
  adminId?: string | null;
  action: string; // e.g. "product.create", "variant.update"
  entityType: string; // e.g. "Product"
  entityId?: string | null;
  meta?: Prisma.InputJsonValue;
  ip?: string | null;
}

/**
 * Append an audit-trail row. Best-effort by design: a failure to write the
 * audit log must never break the underlying operation, so errors are logged and
 * swallowed. Called AFTER the primary operation commits (not inside its
 * transaction) so an audit hiccup can't roll back real work.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        adminId: entry.adminId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        meta: entry.meta,
        ip: entry.ip ?? null,
      },
    });
  } catch (err) {
    logger.error('Failed to write audit log', err);
  }
}
