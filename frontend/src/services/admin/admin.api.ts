import httpClient from '../httpClient';
import { unwrap } from '../http';
import type { ApiResponse } from '@/types';
import type {
  AdminAuditLog,
  AdminAuditLogsQuery,
  AdminAuditLogsResponse,
  AdminPaginationMeta,
  AdminStats,
  AdminUser,
  AdminUsersQuery,
  AdminUsersResponse,
  AdminWorkspace,
  AdminWorkspacesQuery,
  AdminWorkspacesResponse,
} from './admin.types';

const DEFAULT_META: AdminPaginationMeta = { page: 1, limit: 10, total: 0, totalPages: 0 };

export const getStats = async (): Promise<AdminStats> =>
  unwrap(await httpClient.get<ApiResponse<AdminStats>>('/admin/stats'));

export const listUsers = async (query: AdminUsersQuery): Promise<AdminUsersResponse> => {
  const response = await httpClient.get<ApiResponse<{ users: AdminUser[] }>>('/admin/users', {
    params: {
      page: query.page,
      limit: query.limit,
      ...(query.search ? { search: query.search } : {}),
      ...(query.systemRole ? { systemRole: query.systemRole } : {}),
      ...(query.isSuspended !== undefined
        ? { isSuspended: query.isSuspended ? 'true' : 'false' }
        : {}),
    },
  });

  return {
    users: response.data.data?.users ?? [],
    meta: (response.data.meta as AdminPaginationMeta | undefined) ?? DEFAULT_META,
  };
};

export const suspendUser = async (
  userId: string,
  payload: { suspended: boolean; reason?: string }
): Promise<AdminUser> =>
  unwrap(
    await httpClient.patch<ApiResponse<AdminUser>>(`/admin/users/${userId}/suspend`, payload)
  );

export const listWorkspaces = async (
  query: AdminWorkspacesQuery
): Promise<AdminWorkspacesResponse> => {
  const response = await httpClient.get<ApiResponse<{ workspaces: AdminWorkspace[] }>>(
    '/admin/workspaces',
    {
      params: {
        page: query.page,
        limit: query.limit,
        ...(query.search ? { search: query.search } : {}),
        ...(query.plan ? { plan: query.plan } : {}),
        includeDeleted: query.includeDeleted ? 'true' : 'false',
      },
    }
  );

  return {
    workspaces: response.data.data?.workspaces ?? [],
    meta: (response.data.meta as AdminPaginationMeta | undefined) ?? DEFAULT_META,
  };
};

export const listAuditLogs = async (
  query: AdminAuditLogsQuery
): Promise<AdminAuditLogsResponse> => {
  const response = await httpClient.get<ApiResponse<{ auditLogs: AdminAuditLog[] }>>(
    '/admin/audit-logs',
    {
      params: {
        page: query.page,
        limit: query.limit,
        ...(query.action ? { action: query.action } : {}),
        ...(query.targetType ? { targetType: query.targetType } : {}),
        ...(query.dateFrom ? { dateFrom: query.dateFrom } : {}),
        ...(query.dateTo ? { dateTo: query.dateTo } : {}),
      },
    }
  );

  return {
    auditLogs: response.data.data?.auditLogs ?? [],
    meta: (response.data.meta as AdminPaginationMeta | undefined) ?? DEFAULT_META,
  };
};

export default {
  getStats,
  listUsers,
  suspendUser,
  listWorkspaces,
  listAuditLogs,
};
