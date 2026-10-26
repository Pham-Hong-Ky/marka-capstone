import auditRepository, { type AuditLogData } from './audit.repository.js';
import type { AdminAuditLogsQuery, WorkspaceAuditLogsQuery } from './audit.validation.js';

export const recordAuditLog = async (data: AuditLogData) => {
  try {
    return await auditRepository.createAuditLog(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('⚠️ Ghi Audit Log thất bại:', message);
    return null;
  }
};

export const listAuditLogs = async (
  query: AdminAuditLogsQuery | WorkspaceAuditLogsQuery,
  workspaceId?: string
) => {
  const [auditLogs, total] = await auditRepository.listAuditLogsAndCount({
    workspaceId,
    actorId: query.actorId,
    action: query.action,
    targetType: query.targetType,
    targetId: query.targetId,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    skip: (query.page - 1) * query.limit,
    take: query.limit,
  });

  return {
    auditLogs,
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
};

export default {
  recordAuditLog,
  listAuditLogs,
};
