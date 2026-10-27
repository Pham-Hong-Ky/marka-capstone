import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  adminService,
  type AdminAuditLogsQuery,
  type AdminUsersQuery,
  type AdminWorkspacesQuery,
} from '@/services/admin';
import { getErrorMessage } from '@/utils/error';

export const adminKeys = {
  stats: () => ['admin', 'stats'] as const,
  users: (query: AdminUsersQuery) => ['admin', 'users', query] as const,
  workspaces: (query: AdminWorkspacesQuery) => ['admin', 'workspaces', query] as const,
  auditLogs: (query: AdminAuditLogsQuery) => ['admin', 'audit-logs', query] as const,
};

export const useAdminStats = () =>
  useQuery({
    queryKey: adminKeys.stats(),
    queryFn: () => adminService.getStats(),
  });

export const useAdminUsers = (query: AdminUsersQuery) =>
  useQuery({
    queryKey: adminKeys.users(query),
    queryFn: () => adminService.listUsers(query),
  });

export const useAdminWorkspaces = (query: AdminWorkspacesQuery) =>
  useQuery({
    queryKey: adminKeys.workspaces(query),
    queryFn: () => adminService.listWorkspaces(query),
  });

export const useAdminAuditLogs = (
  query: AdminAuditLogsQuery,
  options?: { enabled?: boolean }
) =>
  useQuery({
    queryKey: adminKeys.auditLogs(query),
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
      queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success(variables.suspended ? 'Đã khoá tài khoản' : 'Đã mở khoá tài khoản');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
};
