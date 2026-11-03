import httpClient from '../httpClient';
import { unwrap } from '../http';
import type { ApiResponse } from '@/types';
import type {
  BrandVoice,
  BrandVoiceInsights,
  BrandVoiceInsightsParams,
  BrandVoiceResult,
} from './brandvoice.types';

const base = (workspaceId: string) => `/workspaces/${workspaceId}/brand-voice`;

export const getBrandVoice = async (workspaceId: string): Promise<BrandVoiceResult> =>
  unwrap(await httpClient.get<ApiResponse<BrandVoiceResult>>(base(workspaceId)));

export const updateBrandVoice = async (
  workspaceId: string,
  payload: BrandVoice
): Promise<BrandVoiceResult> =>
  unwrap(await httpClient.put<ApiResponse<BrandVoiceResult>>(base(workspaceId), payload));

export const getInsights = async (
  workspaceId: string,
  params: BrandVoiceInsightsParams = {}
): Promise<BrandVoiceInsights> =>
  unwrap(
    await httpClient.get<ApiResponse<BrandVoiceInsights>>(`${base(workspaceId)}/insights`, {
      params,
    })
  );

export default {
  getBrandVoice,
  updateBrandVoice,
  getInsights,
};
