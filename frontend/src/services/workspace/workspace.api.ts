import httpClient from '../httpClient';
import { unwrap, unwrapPaginated } from '../http';
import type { ApiResponse, PaginationMeta } from '@/types';
import type { AdminAuditLog, AdminAuditLogsQuery, AdminAuditLogsResponse } from '../admin';
import type { WorkspaceRole } from '../auth';
import type {
  AcceptInviteResult,
  InviteMemberPayload,
  InviteMemberResult,
  WorkspaceBase,
  WorkspaceMembersResponse,
  WorkspaceSummary,
} from './workspace.types';

export const createWorkspace = async (data: { name: string }): Promise<WorkspaceSummary> =>
  unwrap(await httpClient.post<ApiResponse<WorkspaceSummary>>('/workspaces', data));

export const updateWorkspace = async (
  id: string,
  data: { name?: string }
): Promise<WorkspaceBase> =>
  unwrap(await httpClient.patch<ApiResponse<WorkspaceBase>>(`/workspaces/${id}`, data));

export const deleteWorkspace = async (id: string): Promise<{ success: boolean }> =>
  unwrap(await httpClient.delete<ApiResponse<{ success: boolean }>>(`/workspaces/${id}`));

export const listMembers = async (id: string): Promise<WorkspaceMembersResponse> =>
  unwrap(await httpClient.get<ApiResponse<WorkspaceMembersResponse>>(`/workspaces/${id}/members`));

export const inviteMember = async (
  id: string,
  payload: InviteMemberPayload
): Promise<InviteMemberResult> =>
  unwrap(
    await httpClient.post<ApiResponse<InviteMemberResult>>(`/workspaces/${id}/invites`, payload)
  );

export const acceptInvite = async (token: string): Promise<AcceptInviteResult> =>
  unwrap(await httpClient.get<ApiResponse<AcceptInviteResult>>(`/invites/${token}`));

export const leaveWorkspace = async (id: string): Promise<{ success: boolean }> =>
  unwrap(await httpClient.delete<ApiResponse<{ success: boolean }>>(`/workspaces/${id}/members/me`));

export const removeMember = async (
  id: string,
  userId: string
): Promise<{ removedMemberId: string }> =>
  unwrap(
    await httpClient.delete<ApiResponse<{ removedMemberId: string }>>(
      `/workspaces/${id}/members/${userId}`
    )
  );

export const changeMemberRole = async (
  id: string,
  userId: string,
  role: WorkspaceRole
): Promise<{ memberId: string; userId: string; role: WorkspaceRole }> =>
  unwrap(
    await httpClient.patch<ApiResponse<{ memberId: string; userId: string; role: WorkspaceRole }>>(
      `/workspaces/${id}/members/${userId}`,
      { role }
    )
  );

export const listAuditLogs = async (
  id: string,
  query: AdminAuditLogsQuery
): Promise<AdminAuditLogsResponse> => {
  const response = await httpClient.get<
    ApiResponse<{ auditLogs: AdminAuditLog[] }, PaginationMeta>
  >(`/workspaces/${id}/audit-logs`, {
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
  listAuditLogs,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  listMembers,
  inviteMember,
  acceptInvite,
  leaveWorkspace,
  removeMember,
  changeMemberRole,
};
