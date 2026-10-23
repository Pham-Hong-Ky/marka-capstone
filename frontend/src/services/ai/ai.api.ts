import httpClient from '../httpClient';
import { unwrap } from '../http';
import type { ApiResponse } from '@/types';
import type {
  AiGeneration,
  StartGenerationResponse,
  StartImagePayload,
  StartTextPayload,
} from './ai.types';

const base = (workspaceId: string) => `/workspaces/${workspaceId}/ai`;

export const startText = async (
  workspaceId: string,
  payload: StartTextPayload
): Promise<StartGenerationResponse> =>
  unwrap(await httpClient.post<ApiResponse<StartGenerationResponse>>(`${base(workspaceId)}/text`, payload));

export const startImage = async (
  workspaceId: string,
  payload: StartImagePayload
): Promise<StartGenerationResponse> =>
  unwrap(
    await httpClient.post<ApiResponse<StartGenerationResponse>>(`${base(workspaceId)}/images`, payload)
  );

export const getGeneration = async (
  workspaceId: string,
  generationId: string
): Promise<AiGeneration> =>
  unwrap(
    await httpClient.get<ApiResponse<AiGeneration>>(
      `${base(workspaceId)}/generations/${generationId}`
    )
  );

export default {
  startText,
  startImage,
  getGeneration,
};
