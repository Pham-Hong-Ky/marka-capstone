import type { Prisma } from '@prisma/client';
import prisma from '../../config/db.js';

export const CHANNEL_PUBLIC_SELECT = {
  id: true,
  platform: true,
  type: true,
  name: true,
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

export const deleteChannelAndCancelSchedules = async (channelId: string): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    await tx.scheduledPost.updateMany({
      where: { channelId, status: 'SCHEDULED' },
      data: { status: 'CANCELLED' },
    });
    await tx.channelConnection.delete({ where: { id: channelId } });
  });
};

export default {
  CHANNEL_PUBLIC_SELECT,
  findChannelsByWorkspace,
  upsertFacebookChannels,
  findChannelInWorkspace,
  deleteChannelAndCancelSchedules,
};
