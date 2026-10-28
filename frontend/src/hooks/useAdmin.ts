import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  adminService,
  type AdminAuditLogsQuery,
  type AdminUsersQuery,
  type AdminWorkspacesQuery,
} from '@/services/admin';
import { queryKeys } from '@/lib/queryKeys';

export const useAdminStats = () =>
  useQuery({
    queryKey: queryKeys.admin.stats(),
    queryFn: () => adminService.getStats(),
  });

export const useAdminUsers = (query: AdminUsersQuery) =>
  useQuery({
    queryKey: queryKeys.admin.users(query),
    queryFn: () => adminService.listUsers(query),
  });

export const useAdminWorkspaces = (query: AdminWorkspacesQuery) =>
  useQuery({
    queryKey: queryKeys.admin.workspaces(query),
    queryFn: () => adminService.listWorkspaces(query),
  });

export const useAdminAuditLogs = (
  query: AdminAuditLogsQuery,
  options?: { enabled?: boolean }
) =>
  useQuery({
    queryKey: queryKeys.admin.auditLogs(query),
    queryFn: () => adminService.listAuditLogs(query),
    enabled: options?.enabled ?? true,
  });

export const useSuspendUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: { userId: string; suspended: boolean; reason?: string }) =>
      adminService.suspendUser(variables.userId, {
        suspended: variables.suspended,
        reason: variables.reason,
      }),
    onSuccess: (_user, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.stats() });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.usersRoot() });
      toast.success(variables.suspended ? 'Đã khoá tài khoản' : 'Đã mở khoá tài khoản');
    },
  });
};
