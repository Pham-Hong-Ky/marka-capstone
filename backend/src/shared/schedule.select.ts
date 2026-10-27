import type { Prisma } from '@prisma/client';

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

export default { SCHEDULE_PUBLIC_SELECT };
