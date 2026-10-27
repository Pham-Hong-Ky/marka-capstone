import type { Prisma, PostStatus, TaskStatus } from '@prisma/client';
import prisma from '../../config/db.js';
import { SCHEDULE_PUBLIC_SELECT } from '../../shared/schedule.select.js';

const POST_AUTHOR_SELECT = { id: true, name: true, avatar: true } as const;

export const createPost = async (data: {
  workspaceId: string;
  title: string;
  content: Prisma.InputJsonValue;
  createdById: string;
}) => {
  return prisma.post.create({ data });
};

export const getPostById = async (postId: string, workspaceId: string) => {
  return prisma.post.findFirst({
    where: { id: postId, workspaceId },
    include: {
      createdBy: { select: POST_AUTHOR_SELECT },
      assignee: { select: POST_AUTHOR_SELECT },
      mediaAssets: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
      scheduledPosts: {
        orderBy: [{ scheduledAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
        select: SCHEDULE_PUBLIC_SELECT,
      },
    },
  });
};

export interface ListPostsParams {
  workspaceId: string;
  skip: number;
  take: number;
  search?: string;
  status?: PostStatus;
  taskStatus?: TaskStatus;
  createdById?: string;
  assigneeId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export const listPostsAndCount = async (params: ListPostsParams) => {
  const where: Prisma.PostWhereInput = {
    workspaceId: params.workspaceId,
    ...(params.search ? { title: { contains: params.search, mode: 'insensitive' } } : {}),
    ...(params.status ? { status: params.status } : {}),
    ...(params.taskStatus ? { taskStatus: params.taskStatus } : {}),
    ...(params.createdById ? { createdById: params.createdById } : {}),
    ...(params.assigneeId ? { assigneeId: params.assigneeId } : {}),
    ...(params.dateFrom || params.dateTo
      ? {
          createdAt: {
            ...(params.dateFrom ? { gte: params.dateFrom } : {}),
            ...(params.dateTo ? { lte: params.dateTo } : {}),
          },
        }
      : {}),
  };

  return prisma.$transaction([
    prisma.post.findMany({
      where,
      select: {
        id: true,
        title: true,
        status: true,
        taskStatus: true,
        assigneeId: true,
        dueAt: true,
        createdById: true,
        createdBy: { select: POST_AUTHOR_SELECT },
        assignee: { select: POST_AUTHOR_SELECT },
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      skip: params.skip,
      take: params.take,
    }),
    prisma.post.count({ where }),
  ]);
};

export const updatePost = async (postId: string, data: { title?: string; content?: Prisma.InputJsonValue }) => {
  return prisma.post.update({ where: { id: postId }, data });
};

// Cập nhật có điều kiện theo trạng thái cũ để hai thao tác đồng thời không cùng vượt qua kiểm tra.
export const transitionPostStatus = async (  postId: string,
  workspaceId: string,
  from: PostStatus,
  data: {
    status: PostStatus;
    submittedById?: string;
    submittedAt?: Date;
    reviewedById?: string;
    reviewedAt?: Date;
    rejectReason?: string | null;
  }
) => {
  const { count } = await prisma.post.updateMany({ where: { id: postId, workspaceId, status: from }, data });
  return count === 0 ? null : prisma.post.findFirst({ where: { id: postId, workspaceId } });
};

export const assignPost = async (
  postId: string,
  data: {
    assigneeId: string | null;
    assignedById: string | null;
    assignedAt: Date | null;
    dueAt: Date | null;
    taskStatus?: TaskStatus;
  }
) => {
  return prisma.post.update({ where: { id: postId }, data });
};

export const updateTaskStatus = async (postId: string, taskStatus: TaskStatus) => {
  return prisma.post.update({ where: { id: postId }, data: { taskStatus } });
};

export type SoftDeletePostResult = 'deleted' | 'publishing';

export const softDeletePost = async (postId: string): Promise<SoftDeletePostResult> => {
  const publishing = Symbol('publishing');

  try {
    return await prisma.$transaction(async (tx) => {
      // Huỷ lịch chờ trước, rồi mới kiểm tra PROCESSING. Nếu worker claim chen
      // giữa hai bước, count sẽ thấy PROCESSING và rollback toàn bộ.
      await tx.scheduledPost.updateMany({
        where: { postId, status: 'SCHEDULED' },
        data: { status: 'CANCELLED', processingStartedAt: null },
      });

      const processing = await tx.scheduledPost.count({
        where: { postId, status: 'PROCESSING' },
      });
      if (processing > 0) throw publishing;

      await tx.post.update({ where: { id: postId }, data: { deletedAt: new Date() } });
      return 'deleted' as const;
    });
  } catch (error) {
    if (error === publishing) return 'publishing';
    throw error;
  }
};

export const createMedia = async (data: {
  workspaceId: string;
  postId: string;
  url: string;
  mimeType: string;
  size: number;
  createdById: string;
}) => {
  return prisma.mediaAsset.create({ data: { ...data, type: 'IMAGE', source: 'UPLOADED' } });
};

export const findMediaByIdAndPost = async (postId: string, mediaId: string) => {
  return prisma.mediaAsset.findFirst({ where: { id: mediaId, postId } });
};

export const softDeleteMedia = async (mediaId: string) => {
  return prisma.mediaAsset.update({ where: { id: mediaId }, data: { deletedAt: new Date() } });
};

export default {
  createPost,
  getPostById,
  listPostsAndCount,
  updatePost,
  transitionPostStatus,
  assignPost,
  updateTaskStatus,
  softDeletePost,
  createMedia,
  findMediaByIdAndPost,
  softDeleteMedia,
};
