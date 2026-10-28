import httpClient from '../httpClient';
import { unwrap, unwrapPaginated } from '../http';
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

export const getStats = async (): Promise<AdminStats> =>
  unwrap(await httpClient.get<ApiResponse<AdminStats>>('/admin/stats'));

export const listUsers = async (query: AdminUsersQuery): Promise<AdminUsersResponse> => {
  const response = await httpClient.get<
    ApiResponse<{ users: AdminUser[] }, AdminPaginationMeta>
  >('/admin/users', {
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
  const { data, meta } = unwrapPaginated(response);

  return { users: data.users, meta };
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
  const response = await httpClient.get<
    ApiResponse<{ workspaces: AdminWorkspace[] }, AdminPaginationMeta>
  >('/admin/workspaces', {
    params: {
      page: query.page,
      limit: query.limit,
      ...(query.search ? { search: query.search } : {}),
      ...(query.plan ? { plan: query.plan } : {}),
      includeDeleted: query.includeDeleted ? 'true' : 'false',
    },
  });
  const { data, meta } = unwrapPaginated(response);

  return { workspaces: data.workspaces, meta };
};

export const listAuditLogs = async (
  query: AdminAuditLogsQuery
): Promise<AdminAuditLogsResponse> => {
  const response = await httpClient.get<
    ApiResponse<{ auditLogs: AdminAuditLog[] }, AdminPaginationMeta>
  >('/admin/audit-logs', {
    params: {
      page: query.page,
      limit: query.limit,
      ...(query.action ? { action: query.action } : {}),
      ...(query.targetType ? { targetType: query.targetType } : {}),
      ...(query.dateFrom ? { dateFrom: query.dateFrom } : {}),
      ...(query.dateTo ? { dateTo: query.dateTo } : {}),
    },
  });
  const { data, meta } = unwrapPaginated(response);

  return { auditLogs: data.auditLogs, meta };
};

export default {
  getStats,
  listUsers,
  suspendUser,
  listWorkspaces,
  listAuditLogs,
};
