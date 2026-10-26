import type { Prisma } from '@prisma/client';
import prisma from '../../config/db.js';
import { recomputePostStatus } from '../schedule/schedule.repository.js';

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

interface UpsertFacebookChannelData {
  externalAccountId: string;
  name: string;
  avatar: string | null;
  accessToken: string;
}

const buildFacebookUpsertArgs = (
  workspaceId: string,
  data: UpsertFacebookChannelData
): Prisma.ChannelConnectionUpsertArgs => ({
  where: {
    workspaceId_platform_externalAccountId: {
      workspaceId,
      platform: 'FACEBOOK',
      externalAccountId: data.externalAccountId,
    },
  },
  update: {
    type: 'REAL',
    name: data.name,
    avatar: data.avatar,
    accessToken: data.accessToken,
    status: 'ACTIVE',
  },
  create: {
    workspaceId,
    platform: 'FACEBOOK',
    type: 'REAL',
    externalAccountId: data.externalAccountId,
    name: data.name,
    avatar: data.avatar,
    accessToken: data.accessToken,
    status: 'ACTIVE',
  },
  select: CHANNEL_PUBLIC_SELECT,
});

export const upsertFacebookChannels = async (
  workspaceId: string,
  pages: UpsertFacebookChannelData[]
): Promise<ChannelSummary[]> =>
  prisma.$transaction(
    pages.map((data) => prisma.channelConnection.upsert(buildFacebookUpsertArgs(workspaceId, data)))
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

export const deleteChannelAndCancelSchedules = async (channelId: string): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    const affectedPosts = await tx.scheduledPost.findMany({
      where: { channelId },
      select: { postId: true },
      distinct: ['postId'],
    });

    await tx.scheduledPost.updateMany({
      where: { channelId, status: 'SCHEDULED' },
      data: { status: 'CANCELLED' },
    });
    await tx.channelConnection.delete({ where: { id: channelId } });

    for (const { postId } of affectedPosts) {
      await recomputePostStatus(tx, postId);
    }
  });
};

export default {
  CHANNEL_PUBLIC_SELECT,
  findChannelsByWorkspace,
  upsertFacebookChannels,
  findChannelInWorkspace,
  findChannelWithToken,
  findChannelDetail,
  findChannelStats,
  updateChannelLabel,
  updateChannelProfile,
  updateChannelStatus,
  deleteChannelAndCancelSchedules,
};
