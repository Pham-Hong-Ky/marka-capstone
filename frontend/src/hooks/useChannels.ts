import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { channelService, getChannelPlatformMeta, type ChannelPlatform } from '@/services/channel';
import { queryKeys } from '@/lib/queryKeys';
import { getErrorMessage } from '@/utils/error';

export const useChannels = (workspaceId: string | null) =>
  useQuery({
    queryKey: queryKeys.channel.list(workspaceId ?? ''),
    queryFn: () => channelService.listChannels(workspaceId as string),
    enabled: Boolean(workspaceId),
  });

export const useChannelDetail = (workspaceId: string | null, channelId: string | null) =>
  useQuery({
    queryKey: queryKeys.channel.detail(workspaceId ?? '', channelId ?? ''),
    queryFn: () => channelService.getChannelDetail(workspaceId as string, channelId as string),
    enabled: Boolean(workspaceId && channelId),
  });

export const usePendingAccounts = (
  platform: ChannelPlatform | null,
  sessionId: string | null
) =>
  useQuery({
    queryKey: queryKeys.channel.pendingAccounts(platform ?? '', sessionId ?? ''),
    queryFn: () =>
      channelService.getPendingAccounts(platform as ChannelPlatform, sessionId as string),
    enabled: Boolean(platform && sessionId),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

export const useStartChannelOauth = () =>
  useMutation({
    mutationFn: ({ platform, workspaceId }: { platform: ChannelPlatform; workspaceId: string }) =>
      channelService.getOauthUrl(platform, workspaceId),
    onSuccess: ({ url }) => window.location.assign(url),
    onError: (error) => toast.error(getErrorMessage(error)),
  });

export const useConnectAccounts = (
  workspaceId: string | null,
  platform: ChannelPlatform | null
) => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId, accountIds }: { sessionId: string; accountIds: string[] }) =>
      channelService.connectAccounts(platform as ChannelPlatform, sessionId, accountIds),
    onSuccess: () => {
      if (workspaceId) {
        qc.invalidateQueries({ queryKey: queryKeys.channel.list(workspaceId) });
      }
      toast.success(`Kết nối ${getChannelPlatformMeta(platform ?? '').label} thành công`);
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
        qc.invalidateQueries({ queryKey: queryKeys.channel.list(workspaceId) });
      }
      if (workspaceId && channelId) {
        qc.invalidateQueries({ queryKey: queryKeys.channel.detail(workspaceId, channelId) });
      }
      toast.success('Đã cập nhật nhãn kênh');
    },
  });
};

export const useRefreshChannel = (workspaceId: string | null, channelId: string | null) => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () => channelService.refreshChannel(workspaceId as string, channelId as string),
    onSuccess: () => {
      if (workspaceId) {
        qc.invalidateQueries({ queryKey: queryKeys.channel.list(workspaceId) });
      }
      if (workspaceId && channelId) {
        qc.invalidateQueries({ queryKey: queryKeys.channel.detail(workspaceId, channelId) });
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
    onSuccess: (_data, channelId) => {
      if (workspaceId) {
        qc.invalidateQueries({ queryKey: queryKeys.channel.list(workspaceId) });
        qc.invalidateQueries({ queryKey: queryKeys.channel.detail(workspaceId, channelId) });
      }
      toast.success('Đã ngắt kết nối kênh');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
};
