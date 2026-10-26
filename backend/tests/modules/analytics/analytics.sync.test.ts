import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import prisma from '../../../src/config/db.js';
import { encrypt } from '../../../src/utils/encryption.js';
import { FacebookTokenExpiredError, facebookClient } from '../../../src/modules/channel/facebook.client.js';
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

  const createPublishedSchedule = async (publishedAt = new Date()) => {
    const post = await prisma.post.create({
      data: { workspaceId: wsId, title: `Bài sync ${Date.now()}`, content, status: 'PUBLISHED', createdById: ownerId },
    });

    return prisma.scheduledPost.create({
      data: {
        postId: post.id,
        channelId,
        status: 'PUBLISHED',
        publishedAt,
        externalPostId: `fb-${post.id}`,
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
    vi.spyOn(facebookClient, 'fetchPostMetrics').mockResolvedValue({
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
    const spy = vi.spyOn(facebookClient, 'fetchPostMetrics').mockResolvedValue({
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

  it('đánh dấu kênh hết hạn khi token bị thu hồi', async () => {
    const schedule = await createPublishedSchedule();
    vi.spyOn(facebookClient, 'fetchPostMetrics').mockRejectedValue(
      new FacebookTokenExpiredError()
    );

    const result = await analyticsService.syncMetrics({ workspaceId: wsId });

    expect(result.failed).toBeGreaterThanOrEqual(1);
    const metric = await prisma.postMetric.findUnique({
      where: { scheduledPostId: schedule.id },
    });
    expect(metric?.syncError).toBeTruthy();

    const channel = await prisma.channelConnection.findUnique({ where: { id: channelId } });
    expect(channel?.status).toBe('EXPIRED');
  });
});
