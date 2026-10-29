import httpClient from '../httpClient';
import { unwrap } from '../http';
import type { ApiResponse } from '@/types';
import type {
  ChannelConnection,
  ChannelDetailResponse,
  ChannelsResponse,
  ChannelPlatform,
  OauthUrlResponse,
  PendingAccountsResponse,
} from './channel.types';

export const listChannels = async (workspaceId: string): Promise<ChannelsResponse> =>
  unwrap(
    await httpClient.get<ApiResponse<ChannelsResponse>>(`/workspaces/${workspaceId}/channels`)
  );

export const getChannelDetail = async (
  workspaceId: string,
  channelId: string
): Promise<ChannelDetailResponse> =>
  unwrap(
    await httpClient.get<ApiResponse<ChannelDetailResponse>>(
      `/workspaces/${workspaceId}/channels/${channelId}`
    )
  );

export const updateChannelLabel = async (
  workspaceId: string,
  channelId: string,
  label: string | null
): Promise<{ channel: ChannelConnection }> =>
  unwrap(
    await httpClient.patch<ApiResponse<{ channel: ChannelConnection }>>(
      `/workspaces/${workspaceId}/channels/${channelId}`,
      { label }
    )
  );

export const refreshChannel = async (
  workspaceId: string,
  channelId: string
): Promise<{ channel: ChannelConnection }> =>
  unwrap(
    await httpClient.post<ApiResponse<{ channel: ChannelConnection }>>(
      `/workspaces/${workspaceId}/channels/${channelId}/refresh`
    )
  );

export const getOauthUrl = async (
  platform: ChannelPlatform,
  workspaceId: string
): Promise<OauthUrlResponse> =>
  unwrap(
    await httpClient.get<ApiResponse<OauthUrlResponse>>(`/channels/${platform}/oauth/url`, {
      params: { workspaceId },
    })
  );

export const getPendingAccounts = async (
  platform: ChannelPlatform,
  sessionId: string
): Promise<PendingAccountsResponse> =>
  unwrap(
    await httpClient.get<ApiResponse<PendingAccountsResponse>>(
      `/channels/${platform}/oauth/session/${sessionId}`
    )
  );

export const connectAccounts = async (
  platform: ChannelPlatform,
  sessionId: string,
  accountIds: string[]
): Promise<ChannelsResponse> =>
  unwrap(
    await httpClient.post<ApiResponse<ChannelsResponse>>(
      `/channels/${platform}/oauth/session/${sessionId}/connect`,
      { accountIds }
    )
  );

export const disconnect = async (channelId: string): Promise<{ success: boolean }> =>
  unwrap(await httpClient.delete<ApiResponse<{ success: boolean }>>(`/channels/${channelId}`));

export default {
  listChannels,
  getChannelDetail,
  updateChannelLabel,
  refreshChannel,
  getOauthUrl,
  getPendingAccounts,
  connectAccounts,
  disconnect,
};
