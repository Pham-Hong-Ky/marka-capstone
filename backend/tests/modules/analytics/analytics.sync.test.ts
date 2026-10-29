import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import prisma from '../../../src/config/db.js';
import { encrypt } from '../../../src/utils/encryption.js';
import { facebookProvider } from '../../../src/modules/channel/providers/facebook.provider.js';
import { threadsProvider } from '../../../src/modules/channel/providers/threads.provider.js';
import { SocialTokenExpiredError } from '../../../src/modules/channel/providers/social-provider.js';
import analyticsService from '../../../src/modules/analytics/analytics.service.js';

const password = 'password123';

const content = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nội dung' }] }],
};

describe('Analytics — đồng bộ số liệu Facebook', () => {
  const stamp = Date.now();
  const owner = { email: `test_analytics_sync_${stamp}@marka.vn`, name: 'Owner Sync' };

  let wsId = '';
  let ownerId = '';
  let channelId = '';

  const createPublishedSchedule = async (
    publishedAt = new Date(),
    targetChannelId = channelId
  ) => {
    const post = await prisma.post.create({
      data: { workspaceId: wsId, title: `Bài sync ${Date.now()}`, content, status: 'PUBLISHED', createdById: ownerId },
    });

    return prisma.scheduledPost.create({
      data: {
        postId: post.id,
        channelId: targetChannelId,
        status: 'PUBLISHED',
        publishedAt,
        externalPostId: `post-${post.id}`,
      },
    });
  };

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: owner.email } });

    const res = await request(app).post('/api/v1/auth/register').send({ ...owner, password });
    ownerId = res.body.data.user.id;
    wsId = res.body.data.user.workspaces[0].id;

    const channel = await prisma.channelConnection.create({
      data: {
        workspaceId: wsId,
        platform: 'FACEBOOK',
        type: 'REAL',
        name: 'Page Sync',
        externalAccountId: `sync-page-${stamp}`,
        accessToken: encrypt('page-token') as string,
        status: 'ACTIVE',
      },
    });
    channelId = channel.id;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lưu số liệu lấy được từ Facebook vào PostMetric', async () => {
    const schedule = await createPublishedSchedule();
    vi.spyOn(facebookProvider, 'fetchMetrics').mockResolvedValue({
      reactions: 12,
      comments: 3,
      shares: 2,
      impressions: 900,
      reach: 600,
      reactionsDetail: { like: 12 },
      partialError: null,
    });

    const result = await analyticsService.syncMetrics({ workspaceId: wsId });

    expect(result.synced).toBeGreaterThanOrEqual(1);
    const metric = await prisma.postMetric.findUnique({
      where: { scheduledPostId: schedule.id },
    });
    expect(metric).toMatchObject({ reactions: 12, comments: 3, shares: 2, impressions: 900, reach: 600 });
  });

  it('bỏ qua bài vừa đồng bộ trong 6 giờ', async () => {
    const schedule = await createPublishedSchedule();
    await prisma.postMetric.create({
      data: {
        scheduledPostId: schedule.id,
        reactions: 1,
        fetchedAt: new Date(),
      },
    });
    const spy = vi.spyOn(facebookProvider, 'fetchMetrics').mockResolvedValue({
      reactions: 99,
      comments: 0,
      shares: 0,
      impressions: null,
      reach: null,
      reactionsDetail: null,
      partialError: null,
    });

    const result = await analyticsService.syncMetrics({ workspaceId: wsId });

    expect(result.total).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });

  it('đồng bộ số liệu Threads qua provider', async () => {
    const threadsChannel = await prisma.channelConnection.create({
      data: {
        workspaceId: wsId,
        platform: 'THREADS',
        type: 'REAL',
        name: 'Threads Sync',
        externalAccountId: `sync-threads-${stamp}`,
        accessToken: encrypt('threads-token') as string,
        status: 'ACTIVE',
      },
    });
    const schedule = await createPublishedSchedule(new Date(), threadsChannel.id);
    vi.spyOn(threadsProvider, 'fetchMetrics').mockResolvedValue({
      reactions: 20,
      comments: 4,
      shares: 3,
      impressions: 1500,
      reach: null,
      reactionsDetail: null,
      partialError: null,
    });

    const result = await analyticsService.syncMetrics({ workspaceId: wsId });

    expect(result.synced).toBeGreaterThanOrEqual(1);
    const metric = await prisma.postMetric.findUnique({
      where: { scheduledPostId: schedule.id },
    });
    expect(metric).toMatchObject({
      reactions: 20,
      comments: 4,
      shares: 3,
      impressions: 1500,
      reach: null,
    });
  });

  it('đánh dấu kênh hết hạn khi token bị thu hồi', async () => {
    const schedule = await createPublishedSchedule();
    vi.spyOn(facebookProvider, 'fetchMetrics').mockRejectedValue(new SocialTokenExpiredError());

    const result = await analyticsService.syncMetrics({ workspaceId: wsId });

    expect(result.failed).toBeGreaterThanOrEqual(1);
    const metric = await prisma.postMetric.findUnique({
      where: { scheduledPostId: schedule.id },
    });
    expect(metric?.syncError).toBeTruthy();

    const channel = await prisma.channelConnection.findUnique({ where: { id: channelId } });
    expect(channel?.status).toBe('EXPIRED');
  });

  it('sync lỗi không được tính là đã đồng bộ', async () => {
    const ws = await prisma.workspace.create({
      data: { name: `WS lỗi sync ${Date.now()}`, plan: 'FREE' },
    });

    try {
      const channel = await prisma.channelConnection.create({
        data: {
          workspaceId: ws.id,
          platform: 'FACEBOOK',
          type: 'REAL',
          name: 'Page lỗi sync',
          externalAccountId: `sync-error-page-${Date.now()}`,
          status: 'ACTIVE',
        },
      });
      const post = await prisma.post.create({
        data: { workspaceId: ws.id, title: 'Bài lỗi sync', content, status: 'PUBLISHED' },
      });
      const schedule = await prisma.scheduledPost.create({
        data: {
          postId: post.id,
          channelId: channel.id,
          status: 'PUBLISHED',
          publishedAt: new Date(),
          externalPostId: 'fb-error',
        },
      });
      await prisma.postMetric.create({
        data: { scheduledPostId: schedule.id, syncError: 'lỗi mạng', fetchedAt: new Date() },
      });

      const overview = await analyticsService.getOverview(ws.id, { range: '30d' });

      expect(overview.coverage.syncedPosts).toBe(0);
      expect(overview.coverage.lastSyncedAt).toBeNull();
    } finally {
      await prisma.workspace.delete({ where: { id: ws.id } });
    }
  });

  it('không đồng bộ bài của kênh đã ngắt kết nối', async () => {
    const ws = await prisma.workspace.create({
      data: { name: `WS ngắt kênh ${Date.now()}`, plan: 'FREE' },
    });

    try {
      const channel = await prisma.channelConnection.create({
        data: {
          workspaceId: ws.id,
          platform: 'FACEBOOK',
          type: 'REAL',
          name: 'Page đã ngắt',
          externalAccountId: `disconnected-page-${Date.now()}`,
          status: 'ACTIVE',
        },
      });
      const post = await prisma.post.create({
        data: { workspaceId: ws.id, title: 'Bài kênh đã ngắt', content, status: 'PUBLISHED' },
      });
      await prisma.scheduledPost.create({
        data: {
          postId: post.id,
          channelId: channel.id,
          status: 'PUBLISHED',
          publishedAt: new Date(),
          externalPostId: 'fb-disconnected',
        },
      });
      await prisma.channelConnection.update({
        where: { id: channel.id },
        data: { deletedAt: new Date() },
      });

      const spy = vi.spyOn(facebookProvider, 'fetchMetrics');
      const result = await analyticsService.syncMetrics({ workspaceId: ws.id });

      expect(result.total).toBe(0);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      await prisma.workspace.delete({ where: { id: ws.id } });
    }
  });
});
