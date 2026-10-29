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

export interface ListAuditLogsParams {
  workspaceId?: string;
  actorId?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  skip: number;
  take: number;
}

export const listAuditLogsAndCount = async (params: ListAuditLogsParams) => {
  const where: Prisma.AuditLogWhereInput = {
    ...(params.workspaceId ? { workspaceId: params.workspaceId } : {}),
    ...(params.actorId ? { actorId: params.actorId } : {}),
    ...(params.action ? { action: params.action } : {}),
    ...(params.targetType ? { targetType: params.targetType } : {}),
    ...(params.targetId ? { targetId: params.targetId } : {}),
    ...(params.dateFrom || params.dateTo
      ? {
          createdAt: {
            ...(params.dateFrom ? { gte: params.dateFrom } : {}),
            ...(params.dateTo ? { lte: params.dateTo } : {}),
          },
        }
      : {}),
  };

  return prisma.$transaction([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: params.skip,
      take: params.take,
      include: {
        actor: { select: { id: true, name: true, email: true } },
        workspace: { select: { id: true, name: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);
};

export default {
  createAuditLog,
  listAuditLogsAndCount,
};
