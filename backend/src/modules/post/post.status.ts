import type { PostStatus, PublishStatus } from '@prisma/client';
import prisma from '../../config/db.js';

type PostTransaction = Pick<typeof prisma, 'post' | 'scheduledPost'>;

export const PUBLISHABLE_POST_STATUSES: PostStatus[] = ['APPROVED', 'FAILED', 'PUBLISHED'];

export const ALLOWED_TRANSITIONS: Record<PostStatus, PostStatus[]> = {
  DRAFT: ['PENDING'],
  PENDING: ['APPROVED', 'REJECTED'],
  REJECTED: ['PENDING'],
  APPROVED: ['SCHEDULED'],
  SCHEDULED: [],
  PUBLISHED: ['SCHEDULED'],
  FAILED: ['SCHEDULED'],
  ARCHIVED: [],
};

export const canTransition = (from: PostStatus, to: PostStatus): boolean =>
  ALLOWED_TRANSITIONS[from].includes(to);

const computeStatusFromSchedules = (statuses: PublishStatus[]): PostStatus | null => {
  if (statuses.length === 0) return null;
  if (statuses.some((status) => status === 'SCHEDULED' || status === 'PROCESSING')) {
    return 'SCHEDULED';
  }
  if (statuses.some((status) => status === 'PUBLISHED')) return 'PUBLISHED';
  if (statuses.some((status) => status === 'FAILED')) return 'FAILED';
  return 'APPROVED';
};

/** Tính lại trạng thái bài từ các lịch còn lại; trả null nếu không cần đổi. */
export const computePostStatus = (
  statuses: PublishStatus[],
  currentStatus: PostStatus
): PostStatus | null => {
  const next = computeStatusFromSchedules(statuses);
  if (next) return next;

  // Không còn lịch (kênh bị ngắt): bài đang chờ/failed quay về APPROVED.
  return currentStatus === 'SCHEDULED' || currentStatus === 'FAILED' ? 'APPROVED' : null;
};

export const recomputePostStatus = async (tx: PostTransaction, postId: string) => {
  const schedules = await tx.scheduledPost.findMany({
    where: { postId },
    select: { status: true },
  });
  const post = await tx.post.findUnique({ where: { id: postId }, select: { status: true } });
  if (!post) return;

  const nextStatus = computePostStatus(
    schedules.map((schedule) => schedule.status),
    post.status
  );
  if (!nextStatus) return;

  await tx.post.updateMany({
    where: { id: postId, status: { not: nextStatus } },
    data: { status: nextStatus },
  });
};

export default { ALLOWED_TRANSITIONS, canTransition, computePostStatus, recomputePostStatus };
