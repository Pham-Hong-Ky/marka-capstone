import type { PostStatus, Prisma, WorkspaceRole } from '@prisma/client';
import postRepository from './post.repository.js';
import postNotification from './post.notification.js';
import type { ListPostsQuery } from './post.validation.js';
import auditService from '../audit/audit.service.js';
import { uploadImageBuffer } from '../../utils/cloudinary.js';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../utils/errors/index.js';

const ALLOWED_TRANSITIONS: Record<PostStatus, PostStatus[]> = {
  DRAFT: ['PENDING'],
  PENDING: ['APPROVED', 'REJECTED'],
  REJECTED: ['PENDING'],
  APPROVED: [],
  SCHEDULED: [],
  PUBLISHED: [],
  FAILED: [],
  ARCHIVED: [],
};

const assertTransition = (from: PostStatus, to: PostStatus) => {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new ConflictError('Không thể chuyển trạng thái bài viết này');
  }
};

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

export const assertEditable = (post: { status: string }) => {
  if (post.status !== 'DRAFT' && post.status !== 'REJECTED') {
    throw new ConflictError('Chỉ có thể thay đổi bản nháp hoặc bài bị từ chối');
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
  assertEditable(post);

  return postRepository.updatePost(postId, data);
};

export const deletePost = async (workspaceId: string, userId: string, role: WorkspaceRole, postId: string) => {
  const post = await getPost(workspaceId, postId);
  assertCanModify(post, userId, role);
  assertEditable(post);

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
  assertEditable(post);

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
  assertEditable(post);

  const media = await postRepository.findMediaByIdAndPost(postId, mediaId);
  if (!media) {
    throw new NotFoundError('Ảnh không tồn tại trong bài viết');
  }

  await postRepository.softDeleteMedia(mediaId);
  return { success: true as const };
};

export const submitPost = async (
  workspaceId: string,
  userId: string,
  userName: string,
  role: WorkspaceRole,
  postId: string
) => {
  const post = await getPost(workspaceId, postId);
  assertCanModify(post, userId, role);
  assertTransition(post.status, 'PENDING');

  const updated = await postRepository.updatePostStatus(postId, {
    status: 'PENDING',
    submittedById: userId,
    submittedAt: new Date(),
    rejectReason: null,
  });

  await postNotification.notifyPostSubmitted({
    workspaceId,
    postId,
    postTitle: post.title,
    actorId: userId,
    actorName: userName,
  });

  await auditService.recordAuditLog({
    workspaceId,
    actorId: userId,
    action: 'POST_SUBMITTED',
    targetType: 'Post',
    targetId: postId,
    metadata: { title: post.title },
  });

  return updated;
};

export const reviewPost = async (
  workspaceId: string,
  reviewerId: string,
  postId: string,
  data: { decision: 'APPROVED' | 'REJECTED'; rejectReason?: string }
) => {
  const post = await getPost(workspaceId, postId);
  assertTransition(post.status, data.decision);

  const approved = data.decision === 'APPROVED';
  const rejectReason = approved ? null : data.rejectReason ?? null;

  const updated = await postRepository.updatePostStatus(postId, {
    status: data.decision,
    reviewedById: reviewerId,
    reviewedAt: new Date(),
    rejectReason,
  });

  await postNotification.notifyPostReviewed({
    workspaceId,
    postId,
    postTitle: post.title,
    authorId: post.createdById,
    approved,
    rejectReason,
  });

  await auditService.recordAuditLog({
    workspaceId,
    actorId: reviewerId,
    action: approved ? 'POST_APPROVED' : 'POST_REJECTED',
    targetType: 'Post',
    targetId: postId,
    reason: rejectReason,
    metadata: { title: post.title },
  });

  return updated;
};

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
};
