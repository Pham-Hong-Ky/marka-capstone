import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  postService,
  type PostListParams,
  type PostPayload,
  type ReviewPostPayload,
  type UpdatePostPayload,
} from '@/services/post';
import { getErrorMessage } from '@/utils/error';
import { hasPublishInProgress, PUBLISH_POLL_INTERVAL_MS } from '@/utils/schedule';

const postKeys = {
  list: (workspaceId: string, params: PostListParams) => ['posts', workspaceId, params] as const,
  detail: (workspaceId: string, postId: string) => ['post', workspaceId, postId] as const,
};

const invalidatePosts = (queryClient: QueryClient, workspaceId: string) => {
  queryClient.invalidateQueries({ queryKey: ['posts', workspaceId] });
  queryClient.invalidateQueries({ queryKey: ['post', workspaceId] });
};

export const usePosts = (workspaceId: string | null, params: PostListParams) =>
  useQuery({
    queryKey: postKeys.list(workspaceId ?? '', params),
    queryFn: () => postService.listPosts(workspaceId as string, params),
    enabled: Boolean(workspaceId),
  });

export const usePost = (workspaceId: string | null, postId: string | null) =>
  useQuery({
    queryKey: postKeys.detail(workspaceId ?? '', postId ?? ''),
    queryFn: () => postService.getPost(workspaceId as string, postId as string),
    enabled: Boolean(workspaceId && postId),
    refetchInterval: (query) =>
      hasPublishInProgress(query.state.data?.schedules) ? PUBLISH_POLL_INTERVAL_MS : false,
  });

export const useCreatePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ workspaceId, payload }: { workspaceId: string; payload: PostPayload }) =>
      postService.createPost(workspaceId, payload),
    onSuccess: (_data, variables) => {
      invalidatePosts(queryClient, variables.workspaceId);
      toast.success('Tạo bài viết thành công');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
};

export const useUpdatePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workspaceId,
      postId,
      payload,
    }: {
      workspaceId: string;
      postId: string;
      payload: UpdatePostPayload;
    }) => postService.updatePost(workspaceId, postId, payload),
    onSuccess: (_data, variables) => {
      invalidatePosts(queryClient, variables.workspaceId);
      toast.success('Lưu bài viết thành công');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
};

export const useDeletePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ workspaceId, postId }: { workspaceId: string; postId: string }) =>
      postService.deletePost(workspaceId, postId),
    onSuccess: (_data, variables) => {
      invalidatePosts(queryClient, variables.workspaceId);
      toast.success('Xóa bài viết thành công');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
};

export const useSubmitPost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ workspaceId, postId }: { workspaceId: string; postId: string }) =>
      postService.submitPost(workspaceId, postId),
    onSuccess: (_data, variables) => {
      invalidatePosts(queryClient, variables.workspaceId);
      toast.success('Đã gửi duyệt bài viết');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
};

export const useReviewPost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workspaceId,
      postId,
      payload,
    }: {
      workspaceId: string;
      postId: string;
      payload: ReviewPostPayload;
    }) => postService.reviewPost(workspaceId, postId, payload),
    onSuccess: (_data, variables) => {
      invalidatePosts(queryClient, variables.workspaceId);
      toast.success(
        variables.payload.decision === 'APPROVED' ? 'Đã duyệt bài viết' : 'Đã từ chối bài viết'
      );
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
};

export const useUploadPostMedia = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workspaceId,
      postId,
      file,
    }: {
      workspaceId: string;
      postId: string;
      file: File;
    }) => postService.uploadPostMedia(workspaceId, postId, file),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['post', variables.workspaceId] });
      toast.success('Tải ảnh lên thành công');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
};

export const useDeletePostMedia = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workspaceId,
      postId,
      mediaId,
    }: {
      workspaceId: string;
      postId: string;
      mediaId: string;
    }) => postService.deletePostMedia(workspaceId, postId, mediaId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['post', variables.workspaceId] });
      toast.success('Đã gỡ ảnh');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
};
