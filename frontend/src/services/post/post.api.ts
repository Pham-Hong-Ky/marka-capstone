import httpClient from '../httpClient';
import { unwrap } from '../http';
import type { ApiResponse } from '@/types';
import type {
  PaginationMeta,
  PostDetail,
  PostListParams,
  PostMedia,
  PostPayload,
  PostsResult,
  ReviewPostPayload,
  UpdatePostPayload,
} from './post.types';

const base = (workspaceId: string) => `/workspaces/${workspaceId}/posts`;

const DEFAULT_META: PaginationMeta = { page: 1, limit: 10, total: 0, totalPages: 0 };

export const listPosts = async (workspaceId: string, params: PostListParams): Promise<PostsResult> => {
  const response = await httpClient.get<ApiResponse<{ posts: PostsResult['posts'] }>>(base(workspaceId), {
    params,
  });

  return {
    posts: response.data.data?.posts ?? [],
    meta: (response.data.meta as PaginationMeta | undefined) ?? DEFAULT_META,
  };
};

export const getPost = async (workspaceId: string, postId: string): Promise<PostDetail> =>
  unwrap(await httpClient.get<ApiResponse<PostDetail>>(`${base(workspaceId)}/${postId}`));

export const createPost = async (workspaceId: string, payload: PostPayload): Promise<PostDetail> =>
  unwrap(await httpClient.post<ApiResponse<PostDetail>>(base(workspaceId), payload));

export const updatePost = async (
  workspaceId: string,
  postId: string,
  payload: UpdatePostPayload
): Promise<PostDetail> => unwrap(await httpClient.patch<ApiResponse<PostDetail>>(`${base(workspaceId)}/${postId}`, payload));

export const deletePost = async (workspaceId: string, postId: string): Promise<void> => {
  await httpClient.delete(`${base(workspaceId)}/${postId}`);
};

export const uploadPostMedia = async (
  workspaceId: string,
  postId: string,
  file: File
): Promise<PostMedia> => {
  const form = new FormData();
  form.append('file', file);
  return unwrap(
    await httpClient.post<ApiResponse<PostMedia>>(`${base(workspaceId)}/${postId}/media`, form, {
      headers: { 'Content-Type': undefined },
    })
  );
};

export const deletePostMedia = async (
  workspaceId: string,
  postId: string,
  mediaId: string
): Promise<void> => {
  await httpClient.delete(`${base(workspaceId)}/${postId}/media/${mediaId}`);
};

export const submitPost = async (workspaceId: string, postId: string): Promise<PostDetail> =>
  unwrap(await httpClient.post<ApiResponse<PostDetail>>(`${base(workspaceId)}/${postId}/submit`, {}));

export const reviewPost = async (
  workspaceId: string,
  postId: string,
  payload: ReviewPostPayload
): Promise<PostDetail> =>
  unwrap(await httpClient.patch<ApiResponse<PostDetail>>(`${base(workspaceId)}/${postId}/review`, payload));

export default {
  listPosts,
  getPost,
  createPost,
  updatePost,
  deletePost,
  uploadPostMedia,
  deletePostMedia,
  submitPost,
  reviewPost,
};
