import httpClient from '../httpClient';
import { unwrap } from '../http';
import type { ApiResponse } from '@/types';
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

export const uploadWorkspaceLogo = async (id: string, file: File): Promise<{ logo: string }> => {
  const form = new FormData();
  form.append('logo', file);
  return unwrap(
    await httpClient.post<ApiResponse<{ logo: string }>>(`/workspaces/${id}/logo`, form, {
      headers: { 'Content-Type': undefined },
    })
  );
};

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

export default {
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  uploadWorkspaceLogo,
  listMembers,
  inviteMember,
  acceptInvite,
  leaveWorkspace,
  removeMember,
  changeMemberRole,
};
