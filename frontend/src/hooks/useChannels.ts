import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { channelService } from '@/services/channel';
import { getErrorMessage } from '@/utils/error';

export const channelKeys = {
  list: (workspaceId: string) => ['channels', workspaceId] as const,
  detail: (workspaceId: string, channelId: string) =>
    ['channel', workspaceId, channelId] as const,
  pendingPages: (sessionId: string) => ['channels', 'facebook', 'pending', sessionId] as const,
};

export const useChannels = (workspaceId: string | null) =>
  useQuery({
    queryKey: channelKeys.list(workspaceId ?? ''),
    queryFn: () => channelService.listChannels(workspaceId as string),
    enabled: Boolean(workspaceId),
  });

export const useChannelDetail = (workspaceId: string | null, channelId: string | null) =>
  useQuery({
    queryKey: channelKeys.detail(workspaceId ?? '', channelId ?? ''),
    queryFn: () => channelService.getChannelDetail(workspaceId as string, channelId as string),
    enabled: Boolean(workspaceId && channelId),
  });

export const useFacebookPendingPages = (sessionId: string | null) =>
  useQuery({
    queryKey: channelKeys.pendingPages(sessionId ?? ''),
    queryFn: () => channelService.getPendingPages(sessionId as string),
    enabled: Boolean(sessionId),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

export const useStartFacebookOauth = () =>
  useMutation({
    mutationFn: (workspaceId: string) => channelService.getFacebookOauthUrl(workspaceId),
    onSuccess: ({ url }) => window.location.assign(url),
    onError: (error) => toast.error(getErrorMessage(error)),
  });

export const useConnectFacebookPages = (workspaceId: string | null) => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId, pageIds }: { sessionId: string; pageIds: string[] }) =>
      channelService.connectPages(sessionId, pageIds),
    onSuccess: () => {
      if (workspaceId) {
        qc.invalidateQueries({ queryKey: channelKeys.list(workspaceId) });
      }
      toast.success('Kết nối Facebook thành công');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
};

export const useUpdateChannelLabel = (workspaceId: string | null, channelId: string | null) => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (label: string | null) =>
      channelService.updateChannelLabel(workspaceId as string, channelId as string, label),
    onSuccess: () => {
      if (workspaceId) {
        qc.invalidateQueries({ queryKey: channelKeys.list(workspaceId) });
      }
      if (workspaceId && channelId) {
        qc.invalidateQueries({ queryKey: channelKeys.detail(workspaceId, channelId) });
      }
      toast.success('Đã cập nhật nhãn kênh');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
};

export const useRefreshChannel = (workspaceId: string | null, channelId: string | null) => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () => channelService.refreshChannel(workspaceId as string, channelId as string),
    onSuccess: () => {
      if (workspaceId) {
        qc.invalidateQueries({ queryKey: channelKeys.list(workspaceId) });
      }
      if (workspaceId && channelId) {
        qc.invalidateQueries({ queryKey: channelKeys.detail(workspaceId, channelId) });
      }
      toast.success('Đã làm mới thông tin kênh');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
};

export const useDisconnectChannel = (workspaceId: string | null) => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (channelId: string) => channelService.disconnect(channelId),
    onSuccess: () => {
      if (workspaceId) {
        qc.invalidateQueries({ queryKey: channelKeys.list(workspaceId) });
      }
      toast.success('Đã ngắt kết nối kênh');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
};
