import type { Prisma, PostStatus } from '@prisma/client';
import prisma from '../../config/db.js';

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
    include: { mediaAssets: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } } },
  });
};

export interface ListPostsParams {
  workspaceId: string;
  skip: number;
  take: number;
  search?: string;
  status?: PostStatus;
  createdById?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export const listPostsAndCount = async (params: ListPostsParams) => {
  const where: Prisma.PostWhereInput = {
    workspaceId: params.workspaceId,
    ...(params.search ? { title: { contains: params.search, mode: 'insensitive' } } : {}),
    ...(params.status ? { status: params.status } : {}),
    ...(params.createdById ? { createdById: params.createdById } : {}),
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
      select: { id: true, title: true, status: true, createdById: true, createdAt: true, updatedAt: true },
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
export const transitionPostStatus = async (
  postId: string,
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

export const softDeletePost = async (postId: string) => {
  return prisma.post.update({ where: { id: postId }, data: { deletedAt: new Date() } });
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
  softDeletePost,
  createMedia,
  findMediaByIdAndPost,
  softDeleteMedia,
};
