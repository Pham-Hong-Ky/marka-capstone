import { getWorkspaceId } from '../../utils/request.js';
import { Request, Response } from 'express';
import type { WorkspaceRole } from '@prisma/client';
import postService from './post.service.js';
import type {
  AssignPostBody,
  ListPostsQuery,
  UpdateTaskStatusBody,
} from './post.validation.js';
import ApiResponse from '../../utils/ApiResponse.js';
import catchAsync from '../../utils/catchAsync.js';

const getPostContext = (req: Request) => ({
  workspaceId: getWorkspaceId(req),
  userId: req.user!.id,
  role: req.workspaceRole as WorkspaceRole,
});

export const createPost = catchAsync(async (req: Request, res: Response) => {
  const workspaceId = getWorkspaceId(req);
  const post = await postService.createPost(workspaceId, req.user!.id, req.body);

  return ApiResponse.success(res, {
    statusCode: 201,
    message: 'Tạo bản nháp thành công',
    data: post,
  });
});

export const getPost = catchAsync(async (req: Request, res: Response) => {
  const workspaceId = getWorkspaceId(req);
  const post = await postService.getPost(workspaceId, req.params.postId as string);

  return ApiResponse.success(res, {
    statusCode: 200,
    message: 'Lấy chi tiết bài viết thành công',
    data: post,
  });
});

export const listPosts = catchAsync(async (req: Request, res: Response) => {
  const workspaceId = getWorkspaceId(req);
  const { posts, meta } = await postService.listPosts(
    workspaceId,
    req.user!.id,
    req.query as unknown as ListPostsQuery
  );

  return ApiResponse.success(res, {
    statusCode: 200,
    message: 'Lấy danh sách bài viết thành công',
    data: { posts },
    meta,
  });
});

export const updatePost = catchAsync(async (req: Request, res: Response) => {
  const { workspaceId, userId, role } = getPostContext(req);
  const post = await postService.updatePost(workspaceId, userId, role, req.params.postId as string, req.body);

  return ApiResponse.success(res, {
    statusCode: 200,
    message: 'Cập nhật bản nháp thành công',
    data: post,
  });
});

export const deletePost = catchAsync(async (req: Request, res: Response) => {
  const { workspaceId, userId, role } = getPostContext(req);
  await postService.deletePost(workspaceId, userId, role, req.params.postId as string);

  return ApiResponse.success(res, {
    statusCode: 200,
    message: 'Xóa bài viết thành công',
    data: { success: true },
  });
});

export const uploadPostMedia = catchAsync(async (req: Request, res: Response) => {
  const { workspaceId, userId, role } = getPostContext(req);
  const media = await postService.uploadPostMedia(
    workspaceId,
    userId,
    role,
    req.params.postId as string,
    req.file
  );

  return ApiResponse.success(res, {
    statusCode: 201,
    message: 'Tải ảnh lên thành công',
    data: media,
  });
});

export const deletePostMedia = catchAsync(async (req: Request, res: Response) => {
  const { workspaceId, userId, role } = getPostContext(req);
  await postService.deletePostMedia(
    workspaceId,
    userId,
    role,
    req.params.postId as string,
    req.params.mediaId as string
  );

  return ApiResponse.success(res, {
    statusCode: 200,
    message: 'Xóa ảnh thành công',
    data: { success: true },
  });
});

export const submitPost = catchAsync(async (req: Request, res: Response) => {
  const { workspaceId, userId, role } = getPostContext(req);
  const post = await postService.submitPost(
    workspaceId,
    userId,
    req.user!.name,
    role,
    req.params.postId as string
  );

  return ApiResponse.success(res, {
    statusCode: 200,
    message: 'Gửi duyệt bài viết thành công',
    data: post,
  });
});

export const reviewPost = catchAsync(async (req: Request, res: Response) => {
  const workspaceId = getWorkspaceId(req);
  const post = await postService.reviewPost(workspaceId, req.user!.id, req.params.postId as string, req.body);

  return ApiResponse.success(res, {
    statusCode: 200,
    message: post.status === 'APPROVED' ? 'Duyệt bài viết thành công' : 'Từ chối bài viết thành công',
    data: post,
  });
});

export const assignPost = catchAsync(async (req: Request, res: Response) => {
  const workspaceId = getWorkspaceId(req);
  const { assigneeId } = req.body as AssignPostBody;
  const post = await postService.assignPost(
    workspaceId,
    req.user!.id,
    req.params.postId as string,
    req.body
  );

  return ApiResponse.success(res, {
    statusCode: 200,
    message: assigneeId ? 'Giao việc thành công' : 'Đã bỏ giao việc',
    data: post,
  });
});

export const updateTaskStatus = catchAsync(async (req: Request, res: Response) => {
  const { workspaceId, userId, role } = getPostContext(req);
  const { status } = req.body as UpdateTaskStatusBody;
  const post = await postService.updateTaskStatus(
    workspaceId,
    userId,
    role,
    req.params.postId as string,
    status
  );

  return ApiResponse.success(res, {
    statusCode: 200,
    message: 'Cập nhật trạng thái công việc thành công',
    data: post,
  });
});

export default {
  createPost,
  getPost,
  listPosts,
  updatePost,
  deletePost,
  uploadPostMedia,
  deletePostMedia,
  submitPost,
  reviewPost,
  assignPost,
  updateTaskStatus,
};
