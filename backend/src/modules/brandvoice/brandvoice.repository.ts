import type { Prisma } from '@prisma/client';
import prisma from '../../config/db.js';

export const findWorkspaceById = async (workspaceId: string) => {
  return prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true },
  });
};

export const getBrandVoiceByWorkspaceId = async (workspaceId: string) => {
  return prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { brandVoice: true },
  });
};

export const updateWorkspaceBrandVoice = async (
  workspaceId: string,
  brandVoice: Prisma.InputJsonValue
) => {
  return prisma.workspace.update({
    where: { id: workspaceId },
    data: { brandVoice },
    select: { brandVoice: true },
  });
};

export const findPublishedPostsForInsights = async ({
  workspaceId,
  since,
  until,
  channelId,
}: {
  workspaceId: string;
  since: Date;
  until: Date;
  channelId?: string;
}) =>
  prisma.scheduledPost.findMany({
    where: {
      status: 'PUBLISHED',
      publishedAt: { gte: since, lte: until },
      channel: {
        workspaceId,
        deletedAt: null,
        ...(channelId ? { id: channelId } : {}),
      },
      post: { deletedAt: null },
      metric: { isNot: null },
    },
    select: {
      id: true,
      publishedAt: true,
      customContent: true,
      channel: { select: { id: true, name: true, platform: true } },
      metric: {
        select: {
          reactions: true,
          comments: true,
          shares: true,
          reach: true,
          impressions: true,
          syncError: true,
          fetchedAt: true,
        },
      },
      post: {
        select: {
          id: true,
          title: true,
          content: true,
          mediaAssets: { where: { deletedAt: null }, select: { id: true }, take: 1 },
        },
      },
    },
    orderBy: { publishedAt: 'desc' },
    take: 500,
  });

export default {
  findWorkspaceById,
  getBrandVoiceByWorkspaceId,
  updateWorkspaceBrandVoice,
  findPublishedPostsForInsights,
};
