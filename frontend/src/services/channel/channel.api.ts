import httpClient from '../httpClient';
import { unwrap } from '../http';
import type { ApiResponse } from '@/types';
import type {
  ChannelConnection,
  ChannelDetailResponse,
  ChannelsResponse,
  FacebookOauthUrlResponse,
  FacebookPendingPagesResponse,
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

export const getFacebookOauthUrl = async (
  workspaceId: string
): Promise<FacebookOauthUrlResponse> =>
  unwrap(
    await httpClient.get<ApiResponse<FacebookOauthUrlResponse>>('/channels/facebook/oauth/url', {
      params: { workspaceId },
    })
  );

export const getPendingPages = async (
  sessionId: string
): Promise<FacebookPendingPagesResponse> =>
  unwrap(
    await httpClient.get<ApiResponse<FacebookPendingPagesResponse>>(
      `/channels/facebook/oauth/session/${sessionId}`
    )
  );

export const connectPages = async (
  sessionId: string,
  pageIds: string[]
): Promise<ChannelsResponse> =>
  unwrap(
    await httpClient.post<ApiResponse<ChannelsResponse>>(
      `/channels/facebook/oauth/session/${sessionId}/connect`,
      { pageIds }
    )
  );

export const disconnect = async (channelId: string): Promise<{ success: boolean }> =>
  unwrap(await httpClient.delete<ApiResponse<{ success: boolean }>>(`/channels/${channelId}`));

export default {
  listChannels,
  getChannelDetail,
  updateChannelLabel,
  refreshChannel,
  getFacebookOauthUrl,
  getPendingPages,
  connectPages,
  disconnect,
};
