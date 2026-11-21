import httpClient from '../httpClient';
import { unwrap } from '../http';
import type { ApiResponse } from '@/types';
import type {
  AiGeneration,
  StartGenerationResponse,
  StartImagePayload,
  StartPostPayload,
  StartPostResponse,
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

export const startPost = async (
  workspaceId: string,
  payload: StartPostPayload
): Promise<StartPostResponse> =>
  unwrap(await httpClient.post<ApiResponse<StartPostResponse>>(`${base(workspaceId)}/post`, payload));

export const getGenerations = async (
  workspaceId: string,
  generationIds: string[]
): Promise<AiGeneration[]> =>
  unwrap(
    await httpClient.get<ApiResponse<{ generations: AiGeneration[] }>>(
      `${base(workspaceId)}/generations`,
      { params: { ids: generationIds.join(',') } }
    )
  ).generations;

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
  startPost,
  getGenerations,
  getGeneration,
};
