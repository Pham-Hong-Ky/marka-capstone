import { Request, Response } from 'express';
import postService from './post.service.js';
import type { ListPostsQuery } from './post.validation.js';
import ApiResponse from '../../utils/ApiResponse.js';
import catchAsync from '../../utils/catchAsync.js';

export const createPost = catchAsync(async (req: Request, res: Response) => {
  const workspaceId = req.workspaceId as string;
  const post = await postService.createPost(workspaceId, req.user!.id, req.body);

  return ApiResponse.success(res, {
    statusCode: 201,
    message: 'Tạo bản nháp thành công',
    data: post,
  });
});

export const getPost = catchAsync(async (req: Request, res: Response) => {
  const workspaceId = req.workspaceId as string;
  const post = await postService.getPost(workspaceId, req.params.postId as string);

  return ApiResponse.success(res, {
    statusCode: 200,
    message: 'Lấy chi tiết bài viết thành công',
    data: post,
  });
});

export const listPosts = catchAsync(async (req: Request, res: Response) => {
  const workspaceId = req.workspaceId as string;
  const { posts, meta } = await postService.listPosts(workspaceId, req.query as unknown as ListPostsQuery);

  return ApiResponse.success(res, {
    statusCode: 200,
    message: 'Lấy danh sách bài viết thành công',
    data: { posts },
    meta,
  });
});

export const updatePost = catchAsync(async (req: Request, res: Response) => {
  const workspaceId = req.workspaceId as string;
  const role = req.workspaceMember?.role ?? 'OWNER';
  const post = await postService.updatePost(workspaceId, req.user!.id, role, req.params.postId as string, req.body);

  return ApiResponse.success(res, {
    statusCode: 200,
    message: 'Cập nhật bản nháp thành công',
    data: post,
  });
});

export const deletePost = catchAsync(async (req: Request, res: Response) => {
  const workspaceId = req.workspaceId as string;
  const role = req.workspaceMember?.role ?? 'OWNER';
  await postService.deletePost(workspaceId, req.user!.id, role, req.params.postId as string);

  return ApiResponse.success(res, {
    statusCode: 200,
    message: 'Xóa bài viết thành công',
    data: { success: true },
  });
});

export const uploadPostMedia = catchAsync(async (req: Request, res: Response) => {
  const workspaceId = req.workspaceId as string;
  const role = req.workspaceMember?.role ?? 'OWNER';
  const media = await postService.uploadPostMedia(
    workspaceId,
    req.user!.id,
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
  const workspaceId = req.workspaceId as string;
  const role = req.workspaceMember?.role ?? 'OWNER';
  await postService.deletePostMedia(
    workspaceId,
    req.user!.id,
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

export default { createPost, getPost, listPosts, updatePost, deletePost, uploadPostMedia, deletePostMedia };
