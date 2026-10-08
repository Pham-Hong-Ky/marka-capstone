import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { workspaceService, type InviteMemberPayload, type WorkspaceMembersResponse } from '@/services/workspace';
import { authService, type AuthUser, type WorkspaceRole } from '@/services/auth';
import { queryClient } from '@/lib/queryClient';
import { useAuthStore } from '@/stores/auth.store';
import { getErrorMessage } from '@/utils/error';

export const workspaceKeys = {
  members: (id: string) => ['workspace', id, 'members'] as const,
  invite: (token: string) => ['invite', token] as const,
};

export const syncSessionUser = async (): Promise<AuthUser | null> => {
  try {
    const user = await authService.getMe();
    useAuthStore.getState().updateUser(user);
    queryClient.setQueryData(['auth', 'me'], user);
    return user;
  } catch (error) {
    console.error('Không đồng bộ được phiên đăng nhập', error);
    return null;
  }
};

export const useWorkspaceMembers = (workspaceId: string | null) =>
  useQuery({
    queryKey: workspaceKeys.members(workspaceId ?? ''),
    queryFn: () => workspaceService.listMembers(workspaceId as string),
    enabled: Boolean(workspaceId),
  });

export const useInviteDetails = (token: string | null) =>
  useQuery({
    queryKey: workspaceKeys.invite(token ?? ''),
    queryFn: () => workspaceService.acceptInvite(token as string),
    enabled: Boolean(token),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

export const useCreateWorkspace = () =>
  useMutation({
    mutationFn: workspaceService.createWorkspace,
    onSuccess: async () => {
      await syncSessionUser();
      toast.success('Tạo workspace thành công');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

export const useUpdateWorkspace = () =>
  useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string } }) =>
      workspaceService.updateWorkspace(id, data),
    onSuccess: async () => {
      await syncSessionUser();
      toast.success('Cập nhật workspace thành công');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

export const useUploadWorkspaceLogo = () =>
  useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      workspaceService.uploadWorkspaceLogo(id, file),
    onSuccess: async () => {
      await syncSessionUser();
      toast.success('Cập nhật logo thành công');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

export const useDeleteWorkspace = () =>
  useMutation({
    mutationFn: (id: string) => workspaceService.deleteWorkspace(id),
    onSuccess: async () => {
      await syncSessionUser();
      toast.success('Xóa workspace thành công');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

export const useInviteMember = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: InviteMemberPayload }) =>
      workspaceService.inviteMember(id, payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: workspaceKeys.members(variables.id) });
      toast.success('Đã gửi lời mời tham gia workspace');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
};

export const useLeaveWorkspace = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => workspaceService.leaveWorkspace(id),
    onSuccess: async (_data, id) => {
      qc.removeQueries({ queryKey: workspaceKeys.members(id) });
      await syncSessionUser();
      toast.success('Đã rời workspace');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
};

export const useRemoveMember = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) =>
      workspaceService.removeMember(id, userId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: workspaceKeys.members(variables.id) });
      toast.success('Đã xóa thành viên');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
};

export const useChangeMemberRole = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, userId, role }: { id: string; userId: string; role: WorkspaceRole }) =>
      workspaceService.changeMemberRole(id, userId, role),
    onMutate: async ({ id, userId, role }) => {
      await qc.cancelQueries({ queryKey: workspaceKeys.members(id) });
      const previous = qc.getQueryData<WorkspaceMembersResponse>(workspaceKeys.members(id));

      if (previous) {
        qc.setQueryData<WorkspaceMembersResponse>(workspaceKeys.members(id), {
          ...previous,
          members: previous.members.map((member) =>
            member.userId === userId ? { ...member, role } : member
          ),
        });
      }

      return { previous, id };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        qc.setQueryData(workspaceKeys.members(context.id), context.previous);
      }
      toast.error(getErrorMessage(error));
    },
    onSuccess: () => toast.success('Đã cập nhật vai trò'),
    onSettled: (_data, _error, variables) => {
      qc.invalidateQueries({ queryKey: workspaceKeys.members(variables.id) });
    },
  });
};
