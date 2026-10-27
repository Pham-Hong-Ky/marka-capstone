import { buildPaginationMeta } from '../../utils/pagination.js';
import { getErrorMessage } from '../../utils/errorMessage.js';
import logger from '../../utils/logger.js';
import type { PostStatus, Prisma, TaskStatus, WorkspaceRole } from '@prisma/client';
import postRepository from './post.repository.js';
import postNotification from './post.notification.js';
import { canTransition } from './post.status.js';
import type { AssignPostBody, ListPostsQuery } from './post.validation.js';
import auditService from '../audit/audit.service.js';
import workspaceService from '../workspace/workspace.service.js';
import { cloudinaryClient } from '../../utils/cloudinary.client.js';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../utils/errors/index.js';

const TRANSITION_CONFLICT_MESSAGE = 'Không thể chuyển trạng thái bài viết này';

const notifySafely = async (action: () => Promise<void>) => {
  try {
    await action();
  } catch (error) {
    logger.warn(`Không gửi được thông báo: ${getErrorMessage(error)}`);
  }
};

const transitionPost = async (
  post: { id: string; workspaceId: string; status: PostStatus },
  data: Parameters<typeof postRepository.transitionPostStatus>[3]
) => {
  if (!canTransition(post.status, data.status)) {
    throw new ConflictError(TRANSITION_CONFLICT_MESSAGE);
  }

  const updated = await postRepository.transitionPostStatus(post.id, post.workspaceId, post.status, data);
  if (!updated) {
    throw new ConflictError(TRANSITION_CONFLICT_MESSAGE);
  }
  return updated;
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
  const post = await postRepository.getPostById(postId, workspaceId);
  if (!post) {
    throw new NotFoundError('Bài viết không tồn tại');
  }

  const { scheduledPosts, ...rest } = post;
  return { ...rest, schedules: scheduledPosts };
};

export const listPosts = async (workspaceId: string, userId: string, query: ListPostsQuery) => {
  const assigneeId = query.assigneeId === 'me' ? userId : query.assigneeId;

  const [posts, total] = await postRepository.listPostsAndCount({
    workspaceId,
    skip: (query.page - 1) * query.limit,
    take: query.limit,
    search: query.search,
    status: query.status,
    taskStatus: query.taskStatus,
    createdById: query.createdById,
    assigneeId,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
  });

  return {
    posts,
    meta: buildPaginationMeta(query.page, query.limit, total),
  };
};

export const assertEditable = (post: { status: PostStatus }) => {
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

  if (role !== 'OWNER') {
    assertCanModify(post, userId, role);
    assertEditable(post);
  }

  const result = await postRepository.softDeletePost(postId);
  if (result === 'publishing') {
    throw new ConflictError('Bài viết đang được đăng, vui lòng thử lại sau');
  }

  await auditService.recordAuditLog({
    workspaceId,
    actorId: userId,
    action: 'POST_DELETED',
    targetType: 'Post',
    targetId: postId,
    metadata: { title: post.title, status: post.status },
  });

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

  const url = await cloudinaryClient.uploadImageBuffer(file.buffer, `marka/workspaces/${workspaceId}/posts/${postId}`);

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

  const updated = await transitionPost(post, {
    status: 'PENDING',
    submittedById: userId,
    submittedAt: new Date(),
    rejectReason: null,
  });

  await notifySafely(() =>
    postNotification.notifyPostSubmitted({
      workspaceId,
      postId,
      postTitle: post.title,
      actorId: userId,
      actorName: userName,
    })
  );

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
  const approved = data.decision === 'APPROVED';
  const rejectReason = approved ? null : data.rejectReason ?? null;

  const updated = await transitionPost(post, {
    status: data.decision,
    reviewedById: reviewerId,
    reviewedAt: new Date(),
    rejectReason,
  });

  await notifySafely(() =>
    postNotification.notifyPostReviewed({
      workspaceId,
      postId,
      postTitle: post.title,
      authorId: post.createdById,
      approved,
      rejectReason,
    })
  );

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

const assertAssigneeIsMember = async (workspaceId: string, assigneeId: string) => {
  if (!(await workspaceService.isWorkspaceMember(workspaceId, assigneeId))) {
    throw new BadRequestError('Người nhận việc không phải là thành viên của workspace');
  }
};

export const assignPost = async (
  workspaceId: string,
  actorId: string,
  postId: string,
  data: AssignPostBody
) => {
  const post = await getPost(workspaceId, postId);
  const assigned = Boolean(data.assigneeId);

  if (data.assigneeId) {
    await assertAssigneeIsMember(workspaceId, data.assigneeId);
  }

  await postRepository.assignPost(postId, {
    assigneeId: data.assigneeId,
    assignedById: assigned ? actorId : null,
    assignedAt: assigned ? new Date() : null,
    dueAt: assigned ? data.dueAt ?? null : null,
    taskStatus: assigned ? undefined : 'TODO',
  });

  if (data.assigneeId) {
    await notifySafely(() =>
      postNotification.notifyTaskAssigned({
        workspaceId,
        postId,
        postTitle: post.title,
        assigneeId: data.assigneeId!,
        actorId,
        dueAt: data.dueAt ?? null,
      })
    );
  }

  await auditService.recordAuditLog({
    workspaceId,
    actorId,
    action: 'POST_ASSIGNED',
    targetType: 'Post',
    targetId: postId,
    metadata: {
      title: post.title,
      assigneeId: data.assigneeId,
      dueAt: data.dueAt ?? null,
    },
  });

  return getPost(workspaceId, postId);
};

export const updateTaskStatus = async (
  workspaceId: string,
  userId: string,
  role: WorkspaceRole,
  postId: string,
  taskStatus: TaskStatus
) => {
  const post = await getPost(workspaceId, postId);

  if (!post.assigneeId) {
    throw new ConflictError('Bài viết chưa được giao việc');
  }

  if (role !== 'OWNER' && post.assigneeId !== userId) {
    throw new ForbiddenError('Chỉ người nhận việc hoặc chủ workspace được cập nhật trạng thái công việc');
  }

  await postRepository.updateTaskStatus(postId, taskStatus);

  await notifySafely(() =>
    postNotification.notifyTaskStatusChanged({
      workspaceId,
      postId,
      postTitle: post.title,
      actorId: userId,
      authorId: post.createdById,
      taskStatus,
    })
  );

  await auditService.recordAuditLog({
    workspaceId,
    actorId: userId,
    action: 'TASK_STATUS_CHANGED',
    targetType: 'Post',
    targetId: postId,
    metadata: { title: post.title, from: post.taskStatus, to: taskStatus },
  });

  return getPost(workspaceId, postId);
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
  assignPost,
  updateTaskStatus,
};
