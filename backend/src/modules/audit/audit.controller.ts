import { getWorkspaceId } from '../../utils/request.js';
import { Request, Response } from 'express';
import auditService from './audit.service.js';
import type { AdminAuditLogsQuery, WorkspaceAuditLogsQuery } from './audit.validation.js';
import ApiResponse from '../../utils/ApiResponse.js';
import catchAsync from '../../utils/catchAsync.js';

export const listAdminAuditLogs = catchAsync(async (req: Request, res: Response) => {
  const query = req.query as unknown as AdminAuditLogsQuery;
  const { auditLogs, meta } = await auditService.listAuditLogs(query, query.workspaceId);

  return ApiResponse.success(res, {
    statusCode: 200,
    message: 'Lấy audit log thành công',
    data: { auditLogs },
    meta,
  });
});

export const listWorkspaceAuditLogs = catchAsync(async (req: Request, res: Response) => {
  const { auditLogs, meta } = await auditService.listAuditLogs(
    req.query as unknown as WorkspaceAuditLogsQuery,
    getWorkspaceId(req)
  );

  return ApiResponse.success(res, {
    statusCode: 200,
    message: 'Lấy audit log của workspace thành công',
    data: { auditLogs },
    meta,
  });
});

export default {
  listAdminAuditLogs,
  listWorkspaceAuditLogs,
};
