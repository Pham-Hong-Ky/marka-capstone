import type { Prisma, WorkspaceRole } from '@prisma/client';
import postRepository from './post.repository.js';
import type { ListPostsQuery } from './post.validation.js';
import { uploadImageBuffer } from '../../utils/cloudinary.js';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../utils/errors/index.js';

export const createPost = async (
  workspaceId: string,
  userId: string,
  data: { title: string; content: Prisma.InputJsonValue }
) => {
  return postRepository.createPost({
    workspaceId,
    title: data.title,
    content: data.content,
    createdById: userId,
  });
};

export const getPost = async (workspaceId: string, postId: string) => {
  const post = await postRepository.findPostWithMedia(postId, workspaceId);
  if (!post) {
    throw new NotFoundError('Bài viết không tồn tại');
  }
  return post;
};

export const listPosts = async (workspaceId: string, query: ListPostsQuery) => {
  const [posts, total] = await postRepository.listPostsAndCount({
    workspaceId,
    skip: (query.page - 1) * query.limit,
    take: query.limit,
    search: query.search,
    createdById: query.createdById,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
  });

  return {
    posts,
    meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
  };
};

export const assertDraft = (post: { status: string }) => {
  if (post.status !== 'DRAFT') {
    throw new ConflictError('Chỉ có thể thay đổi bản nháp');
  }
};

export const assertCanModify = (
  post: { createdById: string | null },
  userId: string,
  role: WorkspaceRole
) => {
  if (role === 'OWNER') {
    return;
  }
  if (post.createdById !== userId) {
    throw new ForbiddenError('Bạn không có quyền thay đổi bài viết này');
  }
};

export const updatePost = async (
  workspaceId: string,
  userId: string,
  role: WorkspaceRole,
  postId: string,
  data: { title?: string; content?: Prisma.InputJsonValue }
) => {
  const post = await getPost(workspaceId, postId);
  assertCanModify(post, userId, role);
  assertDraft(post);

  return postRepository.updatePost(postId, data);
};

export const deletePost = async (workspaceId: string, userId: string, role: WorkspaceRole, postId: string) => {
  const post = await getPost(workspaceId, postId);
  assertCanModify(post, userId, role);
  assertDraft(post);

  await postRepository.softDeletePost(postId);
  return { success: true as const };
};

export const uploadPostMedia = async (
  workspaceId: string,
  userId: string,
  role: WorkspaceRole,
  postId: string,
  file?: Express.Multer.File
) => {
  if (!file) {
    throw new BadRequestError('Vui lòng chọn ảnh để tải lên');
  }

  const post = await getPost(workspaceId, postId);
  assertCanModify(post, userId, role);
  assertDraft(post);

  const url = await uploadImageBuffer(file.buffer, `marka/workspaces/${workspaceId}/posts/${postId}`);

  return postRepository.createMedia({
    workspaceId,
    postId,
    url,
    mimeType: file.mimetype,
    size: file.size,
    createdById: userId,
  });
};

export const deletePostMedia = async (
  workspaceId: string,
  userId: string,
  role: WorkspaceRole,
  postId: string,
  mediaId: string
) => {
  const post = await getPost(workspaceId, postId);
  assertCanModify(post, userId, role);
  assertDraft(post);

  const media = await postRepository.findMediaByIdAndPost(postId, mediaId);
  if (!media) {
    throw new NotFoundError('Ảnh không tồn tại trong bài viết');
  }

  await postRepository.softDeleteMedia(mediaId);
  return { success: true as const };
};

export default { createPost, getPost, listPosts, updatePost, deletePost, uploadPostMedia, deletePostMedia };
