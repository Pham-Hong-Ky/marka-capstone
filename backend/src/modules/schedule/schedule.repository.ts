import type { PostStatus, Prisma, PublishStatus } from '@prisma/client';
import prisma from '../../config/db.js';

type ScheduleTransaction = Pick<typeof prisma, 'post' | 'scheduledPost'>;

export const SCHEDULE_PUBLIC_SELECT = {
  id: true,
  postId: true,
  channelId: true,
  scheduledAt: true,
  status: true,
  externalPostId: true,
  errorMessage: true,
  retryCount: true,
  retryAt: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  post: {
    select: { id: true, title: true, status: true },
  },
  channel: {
    select: {
      id: true,
      name: true,
      avatar: true,
      externalAccountId: true,
      platform: true,
      status: true,
    },
  },
} satisfies Prisma.ScheduledPostSelect;

export type ScheduleSummary = Prisma.ScheduledPostGetPayload<{
  select: typeof SCHEDULE_PUBLIC_SELECT;
}>;

export const findPostForSchedule = async (postId: string, workspaceId: string) =>
  prisma.post.findFirst({
    where: { id: postId, workspaceId, deletedAt: null },
    include: {
      mediaAssets: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'asc' },
        select: { id: true, url: true, type: true, mimeType: true },
      },
    },
  });

export const findChannelsForSchedule = async (workspaceId: string, channelIds: string[]) =>
  prisma.channelConnection.findMany({
    where: { workspaceId, id: { in: channelIds } },
    select: {
      id: true,
      name: true,
      platform: true,
      type: true,
      status: true,
      externalAccountId: true,
    },
  });

// FAILED/PUBLISHED vẫn đăng được để thử lại Page lỗi hoặc đăng thêm Page mới.
export const PUBLISHABLE_POST_STATUSES: PostStatus[] = ['APPROVED', 'FAILED', 'PUBLISHED'];
const OCCUPIED_SCHEDULE_STATUSES: PublishStatus[] = ['SCHEDULED', 'PROCESSING', 'PUBLISHED'];

interface CreateSchedulesParams {
  postId: string;
  workspaceId: string;
  channelIds: string[];
  scheduledAt: Date | null;
}

export const createSchedulesForPost = async ({
  postId,
  workspaceId,
  channelIds,
  scheduledAt,
}: CreateSchedulesParams): Promise<ScheduleSummary[] | 'channel_taken' | null> => {
  const channelTaken = Symbol('channel_taken');

  try {
    return await prisma.$transaction(async (tx) => {
      const { count } = await tx.post.updateMany({
        where: {
          id: postId,
          workspaceId,
          status: { in: PUBLISHABLE_POST_STATUSES },
          deletedAt: null,
        },
        data: { status: 'SCHEDULED' },
      });

      if (count === 0) return null;

      const taken = await tx.scheduledPost.count({
        where: { postId, channelId: { in: channelIds }, status: { in: OCCUPIED_SCHEDULE_STATUSES } },
      });

      if (taken > 0) {
        // Ném lỗi để rollback bước chuyển trạng thái bài phía trên.
        throw channelTaken;
      }

      const schedules: ScheduleSummary[] = [];
      for (const channelId of channelIds) {
        const schedule = await tx.scheduledPost.upsert({
          where: { postId_channelId: { postId, channelId } },
          update: {
            status: 'SCHEDULED',
            scheduledAt,
            externalPostId: null,
            errorMessage: null,
            retryCount: 0,
            retryAt: null,
            processingStartedAt: null,
            publishedAt: null,
          },
          create: {
            postId,
            channelId,
            scheduledAt,
            status: 'SCHEDULED',
          },
          select: SCHEDULE_PUBLIC_SELECT,
        });
        schedules.push(schedule);
      }

      return schedules;
    });
  } catch (error) {
    if (error === channelTaken) return 'channel_taken';
    throw error;
  }
};

interface ListSchedulesParams {
  workspaceId: string;
  status?: PublishStatus;
  from?: Date;
  to?: Date;
  skip: number;
  take: number;
}

const buildListWhere = ({
  workspaceId,
  status,
  from,
  to,
}: Omit<ListSchedulesParams, 'skip' | 'take'>): Prisma.ScheduledPostWhereInput => {
  const range = {
    ...(from ? { gte: from } : {}),
    ...(to ? { lte: to } : {}),
  };

  return {
    channel: { workspaceId },
    ...(status ? { status } : {}),
    // Lịch "đăng ngay" không có scheduledAt → xếp theo thời điểm tạo.
    ...(from || to
      ? { OR: [{ scheduledAt: range }, { scheduledAt: null, createdAt: range }] }
      : {}),
  };
};

export const listSchedulesAndCount = async (params: ListSchedulesParams) => {
  const where = buildListWhere(params);

  return prisma.$transaction([
    prisma.scheduledPost.findMany({
      where,
      select: SCHEDULE_PUBLIC_SELECT,
      orderBy: [{ scheduledAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
      skip: params.skip,
      take: params.take,
    }),
    prisma.scheduledPost.count({ where }),
  ]);
};

export const findScheduleInWorkspace = async (scheduleId: string, workspaceId: string) =>
  prisma.scheduledPost.findFirst({
    where: { id: scheduleId, channel: { workspaceId } },
    select: { id: true, postId: true, status: true },
  });

export const cancelSchedule = async (scheduleId: string, workspaceId: string) =>
  prisma.$transaction(async (tx) => {
    const schedule = await tx.scheduledPost.findFirst({
      where: { id: scheduleId, channel: { workspaceId } },
      select: { id: true, postId: true, status: true },
    });

    if (!schedule) return { outcome: 'not_found' as const };

    const { count } = await tx.scheduledPost.updateMany({
      where: { id: scheduleId, status: 'SCHEDULED' },
      data: { status: 'CANCELLED', processingStartedAt: null },
    });

    if (count === 0) return { outcome: 'not_cancellable' as const };

    await recomputePostStatus(tx, schedule.postId);
    return { outcome: 'cancelled' as const, postId: schedule.postId };
  });

export const findDueScheduleIds = async (limit: number) => {
  const now = new Date();

  return prisma.scheduledPost.findMany({
    where: {
      status: 'SCHEDULED',
      OR: [
        { retryAt: { lte: now } },
        { retryAt: null, OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }] },
      ],
    },
    orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'asc' }],
    take: limit,
    select: { id: true },
  });
};

export const claimSchedule = async (scheduleId: string): Promise<boolean> => {
  const { count } = await prisma.scheduledPost.updateMany({
    where: { id: scheduleId, status: 'SCHEDULED' },
    data: { status: 'PROCESSING', processingStartedAt: new Date() },
  });

  return count === 1;
};

export const findScheduleForPublish = async (scheduleId: string) =>
  prisma.scheduledPost.findFirst({
    where: { id: scheduleId },
    select: {
      id: true,
      postId: true,
      channelId: true,
      status: true,
      scheduledAt: true,
      retryCount: true,
      post: {
        select: {
          id: true,
          title: true,
          content: true,
          workspaceId: true,
          mediaAssets: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'asc' },
            select: { id: true, url: true, type: true, mimeType: true },
          },
        },
      },
      channel: {
        select: {
          id: true,
          workspaceId: true,
          name: true,
          externalAccountId: true,
          accessToken: true,
          status: true,
          platform: true,
        },
      },
    },
  });

export const markSchedulePublished = async (scheduleId: string, externalPostId: string) =>
  prisma.$transaction(async (tx) => {
    const { count } = await tx.scheduledPost.updateMany({
      where: { id: scheduleId, status: 'PROCESSING' },
      data: {
        status: 'PUBLISHED',
        externalPostId,
        errorMessage: null,
        publishedAt: new Date(),
        processingStartedAt: null,
      },
    });

    if (count === 0) return null;

    const schedule = await tx.scheduledPost.findUnique({
      where: { id: scheduleId },
      select: { postId: true },
    });

    if (schedule) await recomputePostStatus(tx, schedule.postId);
    return schedule;
  });

export const markScheduleFailed = async (scheduleId: string, errorMessage: string) =>
  prisma.$transaction(async (tx) => {
    const { count } = await tx.scheduledPost.updateMany({
      where: { id: scheduleId, status: 'PROCESSING' },
      data: {
        status: 'FAILED',
        errorMessage,
        processingStartedAt: null,
      },
    });

    if (count === 0) return null;

    const schedule = await tx.scheduledPost.findUnique({
      where: { id: scheduleId },
      select: { postId: true },
    });

    if (schedule) await recomputePostStatus(tx, schedule.postId);
    return schedule;
  });

export const rescheduleSchedule = async (
  scheduleId: string,
  errorMessage: string,
  delayMs: number
) =>
  prisma.scheduledPost.updateMany({
    where: { id: scheduleId, status: 'PROCESSING' },
    data: {
      status: 'SCHEDULED',
      retryAt: new Date(Date.now() + delayMs),
      errorMessage,
      retryCount: { increment: 1 },
      processingStartedAt: null,
    },
  });

export const recoverStaleSchedules = async (staleBefore: Date): Promise<number> => {
  const stale = await prisma.scheduledPost.findMany({
    where: { status: 'PROCESSING', processingStartedAt: { lt: staleBefore } },
    select: { id: true, postId: true },
  });

  if (stale.length === 0) return 0;

  await prisma.$transaction(async (tx) => {
    for (const schedule of stale) {
      await tx.scheduledPost.updateMany({
        where: { id: schedule.id, status: 'PROCESSING' },
        data: {
          status: 'FAILED',
          errorMessage:
            'Không xác định được kết quả đăng bài do worker dừng đột ngột. Vui lòng kiểm tra Page trước khi đăng lại.',
          processingStartedAt: null,
        },
      });
      await recomputePostStatus(tx, schedule.postId);
    }
  });

  return stale.length;
};

const computePostStatus = (statuses: PublishStatus[]): PostStatus | null => {
  if (statuses.length === 0) return null;
  if (statuses.some((status) => status === 'SCHEDULED' || status === 'PROCESSING')) {
    return 'SCHEDULED';
  }
  if (statuses.some((status) => status === 'PUBLISHED')) return 'PUBLISHED';
  if (statuses.some((status) => status === 'FAILED')) return 'FAILED';
  return 'APPROVED';
};

export const recomputePostStatus = async (tx: ScheduleTransaction, postId: string) => {
  const schedules = await tx.scheduledPost.findMany({
    where: { postId },
    select: { status: true },
  });

  let nextStatus = computePostStatus(schedules.map((schedule) => schedule.status));

  // Kênh bị ngắt có thể xoá hết lịch (cascade). Khi đó bài đang chờ đăng
  // phải quay về APPROVED thay vì kẹt ở SCHEDULED/FAILED.
  if (!nextStatus && schedules.length === 0) {
    const post = await tx.post.findUnique({ where: { id: postId }, select: { status: true } });
    if (post?.status === 'SCHEDULED' || post?.status === 'FAILED') {
      nextStatus = 'APPROVED';
    }
  }

  if (!nextStatus) return;

  await tx.post.updateMany({
    where: { id: postId, status: { not: nextStatus } },
    data: { status: nextStatus },
  });
};

export default {
  SCHEDULE_PUBLIC_SELECT,
  findPostForSchedule,
  findChannelsForSchedule,
  createSchedulesForPost,
  listSchedulesAndCount,
  findScheduleInWorkspace,
  cancelSchedule,
  findDueScheduleIds,
  claimSchedule,
  findScheduleForPublish,
  markSchedulePublished,
  markScheduleFailed,
  rescheduleSchedule,
  recoverStaleSchedules,
  recomputePostStatus,
};
