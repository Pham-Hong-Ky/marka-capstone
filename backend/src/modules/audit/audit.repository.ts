import prisma from '../../config/db.js';
import { Prisma } from '@prisma/client';

export interface AuditLogData {
  workspaceId?: string | null;
  actorId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  reason?: string | null;
  metadata?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
}

export const createAuditLog = async ({
  workspaceId = null,
  actorId = null,
  action,
  targetType,
  targetId = null,
  reason = null,
  metadata = Prisma.DbNull,
}: AuditLogData) => {
  return prisma.auditLog.create({
    data: {
      workspaceId,
      actorId,
      action,
      targetType,
      targetId,
      reason,
      metadata,
    },
  });
};

export default {
  createAuditLog,
};
