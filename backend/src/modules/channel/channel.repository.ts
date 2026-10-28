import type { Prisma, SocialPlatform } from '@prisma/client';
import prisma from '../../config/db.js';
import { recomputePostStatus } from '../post/post.status.js';

export const CHANNEL_PUBLIC_SELECT = {
  id: true,
  platform: true,
  type: true,
  name: true,
  label: true,
  avatar: true,
  externalAccountId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ChannelConnectionSelect;

export type ChannelSummary = Prisma.ChannelConnectionGetPayload<{
  select: typeof CHANNEL_PUBLIC_SELECT;
}>;

export const findChannelsByWorkspace = async (workspaceId: string): Promise<ChannelSummary[]> =>
  prisma.channelConnection.findMany({
    where: { workspaceId },
    select: CHANNEL_PUBLIC_SELECT,
    orderBy: { createdAt: 'desc' },
  });

export interface UpsertChannelData {
  externalAccountId: string;
  name: string;
  avatar: string | null;
  accessToken: string;
}

const buildChannelUpsertArgs = (
  workspaceId: string,
  platform: SocialPlatform,
  data: UpsertChannelData
): Prisma.ChannelConnectionUpsertArgs => ({
  where: {
    workspaceId_platform_externalAccountId: {
      workspaceId,
      platform,
      externalAccountId: data.externalAccountId,
    },
  },
  update: {
    type: 'REAL',
    name: data.name,
    avatar: data.avatar,
    accessToken: data.accessToken,
    status: 'ACTIVE',
    deletedAt: null,
  },
  create: {
    workspaceId,
    platform,
    type: 'REAL',
    externalAccountId: data.externalAccountId,
    name: data.name,
    avatar: data.avatar,
    accessToken: data.accessToken,
    status: 'ACTIVE',
  },
  select: CHANNEL_PUBLIC_SELECT,
});

export const upsertChannels = async (
  workspaceId: string,
  platform: SocialPlatform,
  accounts: UpsertChannelData[]
): Promise<ChannelSummary[]> =>
  prisma.$transaction(
    accounts.map((data) => prisma.channelConnection.upsert(buildChannelUpsertArgs(workspaceId, platform, data)))
  );

export const findChannelInWorkspace = async (channelId: string, workspaceId: string) =>
  prisma.channelConnection.findFirst({
    where: { id: channelId, workspaceId },
    select: {
      id: true,
      workspaceId: true,
      name: true,
      externalAccountId: true,
    },
  });

export const findChannelWithToken = async (channelId: string, workspaceId: string) =>
  prisma.channelConnection.findFirst({
    where: { id: channelId, workspaceId },
    select: {
      id: true,
      workspaceId: true,
      platform: true,
      status: true,
      accessToken: true,
      externalAccountId: true,
    },
  });

export const findChannelDetail = async (channelId: string, workspaceId: string) =>
  prisma.channelConnection.findFirst({
    where: { id: channelId, workspaceId },
    select: CHANNEL_PUBLIC_SELECT,
  });

export const findChannelStats = async (channelId: string) => {
  const [publishedPosts, metrics, lastPublished] = await Promise.all([
    prisma.scheduledPost.count({ where: { channelId, status: 'PUBLISHED' } }),
    prisma.postMetric.aggregate({
      where: { scheduledPost: { channelId, status: 'PUBLISHED' } },
      _sum: {
        reactions: true,
        comments: true,
        shares: true,
        impressions: true,
        reach: true,
      },
      _max: { fetchedAt: true },
    }),
    prisma.scheduledPost.findFirst({
      where: { channelId, status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' },
      select: { publishedAt: true },
    }),
  ]);

  return {
    publishedPosts,
    reactions: metrics._sum.reactions ?? 0,
    comments: metrics._sum.comments ?? 0,
    shares: metrics._sum.shares ?? 0,
    impressions: metrics._sum.impressions ?? 0,
    reach: metrics._sum.reach ?? 0,
    lastPublishedAt: lastPublished?.publishedAt ?? null,
    lastSyncedAt: metrics._max.fetchedAt ?? null,
  };
};

export const updateChannelLabel = async (channelId: string, label: string | null) =>
  prisma.channelConnection.update({
    where: { id: channelId },
    data: { label },
    select: CHANNEL_PUBLIC_SELECT,
  });

export const updateChannelProfile = async (
  channelId: string,
  data: { name: string; avatar: string | null }
) =>
  prisma.channelConnection.update({
    where: { id: channelId },
    data,
    select: CHANNEL_PUBLIC_SELECT,
  });

export const updateChannelStatus = async (
  channelId: string,
  status: 'ACTIVE' | 'EXPIRED'
) =>
  prisma.channelConnection.update({
    where: { id: channelId },
    data: { status },
  });

export const disconnectChannelAndCancelSchedules = async (
  channelId: string
): Promise<'disconnected' | 'publishing'> => {
  const publishing = Symbol('publishing');

  try {
    return await prisma.$transaction(async (tx) => {
      // Huỷ lịch chờ trước, rồi mới kiểm tra PROCESSING. Nếu worker claim chen
      // giữa hai bước, count sẽ thấy PROCESSING và rollback toàn bộ.
      await tx.scheduledPost.updateMany({
        where: { channelId, status: 'SCHEDULED' },
        data: { status: 'CANCELLED', processingStartedAt: null },
      });

      const processing = await tx.scheduledPost.count({
        where: { channelId, status: 'PROCESSING' },
      });
      if (processing > 0) throw publishing;

      const affectedPosts = await tx.scheduledPost.findMany({
        where: { channelId },
        select: { postId: true },
        distinct: ['postId'],
      });

      await tx.channelConnection.update({
        where: { id: channelId },
        data: { deletedAt: new Date(), accessToken: null, status: 'EXPIRED' },
      });

      for (const { postId } of affectedPosts) {
        await recomputePostStatus(tx, postId);
      }
      return 'disconnected' as const;
    });
  } catch (error) {
    if (error === publishing) return 'publishing';
    throw error;
  }
};

export default {
  CHANNEL_PUBLIC_SELECT,
  findChannelsByWorkspace,
  upsertChannels,
  findChannelInWorkspace,
  findChannelWithToken,
  findChannelDetail,
  findChannelStats,
  updateChannelLabel,
  updateChannelProfile,
  updateChannelStatus,
  disconnectChannelAndCancelSchedules,
};
