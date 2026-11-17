import httpClient from '../httpClient';
import { unwrap } from '../http';
import type { ApiResponse } from '@/types';
import type { PostDetail, PostVersionSummary } from './post.types';

const base = (workspaceId: string, postId: string) =>
  `/workspaces/${workspaceId}/posts/${postId}/versions`;

export const listPostVersions = async (
  workspaceId: string,
  postId: string
): Promise<PostVersionSummary[]> => {
  const data = unwrap(
    await httpClient.get<ApiResponse<{ versions: PostVersionSummary[] }>>(base(workspaceId, postId))
  );
  return data.versions;
};

export const restorePostVersion = async (
  workspaceId: string,
  postId: string,
  version: number
): Promise<PostDetail> =>
  unwrap(
    await httpClient.post<ApiResponse<PostDetail>>(`${base(workspaceId, postId)}/${version}/restore`, {})
  );

export default {
  listPostVersions,
  restorePostVersion,
};
