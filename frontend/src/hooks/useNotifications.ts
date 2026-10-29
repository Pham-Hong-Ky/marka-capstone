import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { notificationService } from '@/services/notification';
import { queryKeys } from '@/lib/queryKeys';
import { getErrorMessage } from '@/utils/error';

const POLL_INTERVAL_MS = 30_000;

export const useNotifications = (workspaceId: string | null) =>
  useQuery({
    queryKey: queryKeys.notification.list(workspaceId),
    queryFn: () =>
      notificationService.listNotifications({
        limit: 10,
        workspaceId: workspaceId ?? undefined,
      }),
    enabled: Boolean(workspaceId),
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });

export const useUnreadNotificationCount = (workspaceId: string | null) =>
  useQuery({
    queryKey: queryKeys.notification.unread(workspaceId),
    queryFn: () => notificationService.getUnreadCount(workspaceId ?? undefined),
    enabled: Boolean(workspaceId),
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });

export const useMarkNotificationRead = (workspaceId: string | null) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) =>
      notificationService.markNotificationRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notification.list(workspaceId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.notification.unread(workspaceId) });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
};

export const useMarkAllNotificationsRead = (workspaceId: string | null) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => notificationService.markAllNotificationsRead(workspaceId ?? undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notification.list(workspaceId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.notification.unread(workspaceId) });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
};

export default {
  useNotifications,
  useUnreadNotificationCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
};
