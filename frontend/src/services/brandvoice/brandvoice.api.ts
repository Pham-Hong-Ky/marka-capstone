import httpClient from '../httpClient';
import { unwrap } from '../http';
import type { ApiResponse } from '@/types';
import type { BrandVoice, BrandVoiceResult } from './brandvoice.types';

const base = (workspaceId: string) => `/workspaces/${workspaceId}/brand-voice`;

export const getBrandVoice = async (workspaceId: string): Promise<BrandVoiceResult> =>
  unwrap(await httpClient.get<ApiResponse<BrandVoiceResult>>(base(workspaceId)));

export const updateBrandVoice = async (
  workspaceId: string,
  payload: BrandVoice
): Promise<BrandVoiceResult> =>
  unwrap(await httpClient.put<ApiResponse<BrandVoiceResult>>(base(workspaceId), payload));

export default {
  getBrandVoice,
  updateBrandVoice,
};
