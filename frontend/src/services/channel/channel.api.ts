import httpClient from '../httpClient';
import { unwrap } from '../http';
import type { ApiResponse } from '@/types';
import type {
  ChannelsResponse,
  FacebookOauthUrlResponse,
  FacebookPendingPagesResponse,
} from './channel.types';

export const listChannels = async (workspaceId: string): Promise<ChannelsResponse> =>
  unwrap(
    await httpClient.get<ApiResponse<ChannelsResponse>>(`/workspaces/${workspaceId}/channels`)
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
  getFacebookOauthUrl,
  getPendingPages,
  connectPages,
  disconnect,
};
