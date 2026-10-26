import prisma from '../../config/db.js';
export interface MetricRowsQuery {
  workspaceId: string;
  start: Date;
  end: Date;
  channelId?: string;
  tag?: string;
}

export const findMetricRows = async ({
  workspaceId,
  start,
  end,
  channelId,
  tag,
}: MetricRowsQuery) =>
  prisma.scheduledPost.findMany({
    where: {
      status: 'PUBLISHED',
      publishedAt: { gte: start, lte: end },
      channel: { workspaceId, ...(channelId ? { id: channelId } : {}) },
      post: { deletedAt: null, ...(tag ? { campaignTag: tag } : {}) },
    },
    select: {
      publishedAt: true,
      metric: {
        select: {
          reactions: true,
          comments: true,
          shares: true,
          impressions: true,
          reach: true,
          fetchedAt: true,
        },
      },
    },
  });

export const findPublishedForSuggestions = async ({
  workspaceId,
  since,
  channelId,
}: {
  workspaceId: string;
  since: Date;
  channelId?: string;
}) =>
  prisma.scheduledPost.findMany({
    where: {
      status: 'PUBLISHED',
      publishedAt: { gte: since },
      channel: { workspaceId, ...(channelId ? { id: channelId } : {}) },
      post: { deletedAt: null },
    },
    select: {
      publishedAt: true,
      metric: {
        select: {
          reactions: true,
          comments: true,
          shares: true,
          impressions: true,
          reach: true,
        },
      },
      post: {
        select: {
          content: true,
          mediaAssets: { where: { deletedAt: null }, select: { id: true }, take: 1 },
        },
      },
    },
  });

export const findDraftPostsForSuggestions = async (workspaceId: string) =>
  prisma.post.findMany({
    where: {
      workspaceId,
      status: { in: ['DRAFT', 'APPROVED', 'REJECTED', 'SCHEDULED'] },
    },
    select: {
      id: true,
      title: true,
      content: true,
      updatedAt: true,
      mediaAssets: { where: { deletedAt: null }, select: { id: true }, take: 1 },
      scheduledPosts: {
        where: { status: 'SCHEDULED' },
        orderBy: { scheduledAt: 'asc' },
        take: 1,
        select: { scheduledAt: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: 20,
  });

export const findCampaignTags = async (workspaceId: string): Promise<string[]> => {
  const rows = await prisma.post.findMany({
    where: { workspaceId, campaignTag: { not: null } },
    select: { campaignTag: true },
    distinct: ['campaignTag'],
    orderBy: { campaignTag: 'asc' },
  });

  return rows
    .map((row) => row.campaignTag)
    .filter((tag): tag is string => Boolean(tag));
};

export const findSchedulesToSync = async ({
  workspaceId,
  publishedSince,
  staleBefore,
  take,
}: {
  workspaceId?: string;
  publishedSince: Date;
  staleBefore: Date;
  take: number;
}) =>
  prisma.scheduledPost.findMany({
    where: {
      status: 'PUBLISHED',
      externalPostId: { not: null },
      publishedAt: { gte: publishedSince },
      channel: {
        platform: 'FACEBOOK',
        status: 'ACTIVE',
        ...(workspaceId ? { workspaceId } : {}),
      },
      OR: [
        { metric: { is: null } },
        { metric: { OR: [{ fetchedAt: null }, { fetchedAt: { lt: staleBefore } }] } },
      ],
    },
    select: {
      id: true,
      externalPostId: true,
      channel: { select: { id: true, accessToken: true } },
    },
    orderBy: { publishedAt: 'desc' },
    take,
  });

export interface MetricPayload {
  reactions: number;
  comments: number;
  shares: number;
  impressions: number | null;
  reach: number | null;
  reactionsDetail: Record<string, number> | null;
  partialError: string | null;
}

const reactionsDetailData = (value: Record<string, number> | null) =>
  value ? { reactionsDetail: value } : {};

export const saveMetric = async (scheduledPostId: string, payload: MetricPayload) => {
  const base = {
    reactions: payload.reactions,
    comments: payload.comments,
    shares: payload.shares,
    impressions: payload.impressions,
    reach: payload.reach,
    syncError: payload.partialError,
    fetchedAt: new Date(),
  };
  const detail = reactionsDetailData(payload.reactionsDetail);

  return prisma.postMetric.upsert({
    where: { scheduledPostId },
    update: { ...base, ...detail },
    create: { scheduledPostId, ...base, ...detail },
  });
};

export const markMetricError = async (scheduledPostId: string, message: string) =>
  prisma.postMetric.upsert({
    where: { scheduledPostId },
    update: { syncError: message, fetchedAt: new Date() },
    create: { scheduledPostId, syncError: message, fetchedAt: new Date() },
  });

export const markChannelExpired = async (channelId: string) =>
  prisma.channelConnection.updateMany({
    where: { id: channelId },
    data: { status: 'EXPIRED' },
  });

export default {
  findMetricRows,
  findPublishedForSuggestions,
  findDraftPostsForSuggestions,
  findCampaignTags,
  findSchedulesToSync,
  saveMetric,
  markMetricError,
  markChannelExpired,
};
