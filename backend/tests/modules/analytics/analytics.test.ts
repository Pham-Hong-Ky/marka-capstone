import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import prisma from '../../../src/config/db.js';
import redis from '../../../src/config/redis.js';
import analyticsRepository from '../../../src/modules/analytics/analytics.repository.js';
import { analyticsQueue } from '../../../src/workers/queues.js';

const password = 'password123';

const content = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

describe('Analytics — thống kê & gợi ý', () => {
  const stamp = Date.now();
  const owner = { email: `test_analytics_owner_${stamp}@marka.vn`, name: 'Owner Analytics' };
  const creator = { email: `test_analytics_creator_${stamp}@marka.vn`, name: 'Creator Analytics' };
  const outsider = { email: `test_analytics_outsider_${stamp}@marka.vn`, name: 'Outsider Analytics' };

  let creatorToken = '';
  let outsiderToken = '';
  let wsId = '';
  let outsiderWorkspaceId = '';
  let ownerId = '';
  let channelId = '';
  let outsiderChannelId = '';

  const createChannel = async (workspaceId: string, pageId: string) =>
    prisma.channelConnection.create({
      data: {
        workspaceId,
        platform: 'FACEBOOK',
        type: 'REAL',
        name: `Page ${pageId}`,
        externalAccountId: pageId,
        status: 'ACTIVE',
      },
    });

  const createPublishedPost = async ({
    workspaceId,
    targetChannelId,
    publishedAt,
    text,
    reactions,
    comments,
    shares,
    impressions,
    reach = null,
    media = false,
  }: {
    workspaceId: string;
    targetChannelId: string;
    publishedAt: Date;
    text: string;
    reactions: number;
    comments: number;
    shares: number;
    impressions: number | null;
    reach?: number | null;
    media?: boolean;
  }) => {
    const post = await prisma.post.create({
      data: {
        workspaceId,
        title: `Bài ${publishedAt.toISOString()}`,
        content: content(text),
        status: 'PUBLISHED',
        createdById: ownerId,
      },
    });

    if (media) {
      await prisma.mediaAsset.create({
        data: {
          workspaceId,
          postId: post.id,
          url: 'https://res.cloudinary.com/demo/image/upload/a.png',
          type: 'IMAGE',
          mimeType: 'image/png',
          size: 1024,
          createdById: ownerId,
        },
      });
    }

    const schedule = await prisma.scheduledPost.create({
      data: {
        postId: post.id,
        channelId: targetChannelId,
        status: 'PUBLISHED',
        publishedAt,
        externalPostId: `fb-${post.id}`,
      },
    });

    await prisma.postMetric.create({
      data: {
        scheduledPostId: schedule.id,
        reactions,
        comments,
        shares,
        impressions,
        reach,
        fetchedAt: new Date(),
      },
    });

    return post.id;
  };

  const createDraft = async (workspaceId: string, title: string, text: string) =>
    prisma.post.create({
      data: { workspaceId, title, content: content(text), status: 'DRAFT', createdById: ownerId },
    });

  beforeAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [owner.email, creator.email, outsider.email] } },
    });

    const ownerRes = await request(app).post('/api/v1/auth/register').send({ ...owner, password });
    ownerId = ownerRes.body.data.user.id;
    wsId = ownerRes.body.data.user.workspaces[0].id;

    const creatorRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...creator, password });
    creatorToken = creatorRes.body.data.accessToken;
    await prisma.workspaceMember.create({
      data: { workspaceId: wsId, userId: creatorRes.body.data.user.id, role: 'CONTENT_CREATOR' },
    });

    const outsiderRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...outsider, password });
    outsiderToken = outsiderRes.body.data.accessToken;
    outsiderWorkspaceId = outsiderRes.body.data.user.workspaces[0].id;

    const channel = await createChannel(wsId, `analytics-page-${stamp}`);
    channelId = channel.id;
    const outsiderChannel = await createChannel(outsiderWorkspaceId, `analytics-out-${stamp}`);
    outsiderChannelId = outsiderChannel.id;

    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    await createPublishedPost({
      workspaceId: wsId,
      targetChannelId: channelId,
      publishedAt: twoDaysAgo,
      text: 'Bài số một có ảnh và nội dung đủ dài?',
      reactions: 10,
      comments: 2,
      shares: 1,
      impressions: 1000,
      reach: 800,
      media: true,
    });
    await createPublishedPost({
      workspaceId: wsId,
      targetChannelId: channelId,
      publishedAt: new Date(twoDaysAgo.getTime() + 3 * 60 * 60 * 1000),
      text: 'Bài số hai không có ảnh nhưng nội dung cũng đủ dài?',
      reactions: 5,
      comments: 1,
      shares: 0,
      impressions: 500,
      reach: 400,
    });

    await createDraft(wsId, 'Nháp thiếu ảnh', 'Ngắn');
    await createDraft(outsiderWorkspaceId, 'Nháp của workspace khác', 'Ngắn');

    await createPublishedPost({
      workspaceId: outsiderWorkspaceId,
      targetChannelId: outsiderChannel.id,
      publishedAt: twoDaysAgo,
      text: 'Bài của workspace khác',
      reactions: 100,
      comments: 50,
      shares: 20,
      impressions: 1000,
    });
  });

  it('trả tổng quan theo khoảng thời gian và tỷ lệ tương tác', async () => {
    const res = await request(app)
      .get(`/api/v1/workspaces/${wsId}/analytics/overview?range=30d`)
      .set('Authorization', `Bearer ${creatorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.summary).toMatchObject({
      likes: 15,
      comments: 3,
      shares: 1,
      impressions: 1500,
      engagementRate: 1.27,
    });
    expect(res.body.data.series).toHaveLength(30);
    expect(res.body.data.coverage).toMatchObject({ publishedPosts: 2, syncedPosts: 2 });
  });

  it('tổng quan có số liệu theo từng kênh và không lẫn kênh workspace khác', async () => {
    const res = await request(app)
      .get(`/api/v1/workspaces/${wsId}/analytics/overview?range=30d`)
      .set('Authorization', `Bearer ${creatorToken}`);

    expect(res.status).toBe(200);
    const byChannel = res.body.data.byChannel as Array<Record<string, unknown>>;
    expect(byChannel).toHaveLength(1);
    expect(byChannel[0]).toMatchObject({
      channelId,
      name: `Page analytics-page-${stamp}`,
      platform: 'FACEBOOK',
      posts: 2,
      likes: 15,
      comments: 3,
      shares: 1,
      impressions: 1500,
      engagement: 19,
    });
  });

  it('liệt kê bài đã đăng kèm kênh và số liệu, mặc định bài mới nhất trước', async () => {
    const res = await request(app)
      .get(`/api/v1/workspaces/${wsId}/analytics/posts?range=30d`)
      .set('Authorization', `Bearer ${creatorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.meta).toMatchObject({ page: 1, total: 2, totalPages: 1 });

    const posts = res.body.data.posts as Array<{
      channel: { id: string; name: string };
      impressions: number | null;
      syncStatus: string;
      publishedAt: string;
    }>;
    expect(posts).toHaveLength(2);
    expect(posts[0].impressions).toBe(500);
    expect(posts[0].channel).toMatchObject({ id: channelId, name: `Page analytics-page-${stamp}` });
    expect(posts.every((post) => post.syncStatus === 'synced')).toBe(true);
    expect(new Date(posts[0].publishedAt).getTime()).toBeGreaterThan(
      new Date(posts[1].publishedAt).getTime()
    );
  });

  it('sắp xếp theo lượt xem và phân trang danh sách bài', async () => {
    const sorted = await request(app)
      .get(`/api/v1/workspaces/${wsId}/analytics/posts?range=30d&sort=impressions&limit=1&page=1`)
      .set('Authorization', `Bearer ${creatorToken}`);

    expect(sorted.status).toBe(200);
    expect(sorted.body.data.posts).toHaveLength(1);
    expect(sorted.body.data.posts[0].impressions).toBe(1000);
    expect(sorted.body.meta).toMatchObject({ page: 1, limit: 1, total: 2, totalPages: 2 });

    const secondPage = await request(app)
      .get(`/api/v1/workspaces/${wsId}/analytics/posts?range=30d&sort=impressions&limit=1&page=2`)
      .set('Authorization', `Bearer ${creatorToken}`);

    expect(secondPage.body.data.posts[0].impressions).toBe(500);
  });

  it('danh sách bài không trả dữ liệu của kênh thuộc workspace khác', async () => {
    const res = await request(app)
      .get(`/api/v1/workspaces/${wsId}/analytics/posts?range=30d&channelId=${outsiderChannelId}`)
      .set('Authorization', `Bearer ${creatorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.posts).toEqual([]);

    const forbidden = await request(app)
      .get(`/api/v1/workspaces/${wsId}/analytics/posts?range=30d`)
      .set('Authorization', `Bearer ${outsiderToken}`);

    expect(forbidden.status).toBe(403);
  });

  it('từ chối tham số sắp xếp không hợp lệ ở danh sách bài', async () => {
    const res = await request(app)
      .get(`/api/v1/workspaces/${wsId}/analytics/posts?sort=abc`)
      .set('Authorization', `Bearer ${creatorToken}`);

    expect(res.status).toBe(422);
  });

  it('bấm đồng bộ lần nữa trong thời gian chờ bị từ chối 429 và chỉ có một job', async () => {
    const jobId = `analytics-sync-${wsId}`;
    const cooldownKey = `analytics:sync-cooldown:${wsId}`;
    await analyticsQueue.remove(jobId);
    await redis.del(cooldownKey);

    try {
      const first = await request(app)
        .post(`/api/v1/workspaces/${wsId}/analytics/sync`)
        .set('Authorization', `Bearer ${creatorToken}`);
      expect(first.status).toBe(202);

      const second = await request(app)
        .post(`/api/v1/workspaces/${wsId}/analytics/sync`)
        .set('Authorization', `Bearer ${creatorToken}`);
      expect(second.status).toBe(429);
      expect(second.body.status).toBe('fail');
      expect(second.body.message).toContain('giây');

      const jobs = await analyticsQueue.getJobs(['waiting', 'delayed', 'active']);
      expect(jobs.filter((job) => job.id === jobId)).toHaveLength(1);
    } finally {
      await analyticsQueue.remove(jobId);
      await redis.del(cooldownKey);
    }
  });

  it('lịch tự động bỏ qua bài vừa có số liệu, đồng bộ thủ công (force) vẫn lấy lại', async () => {
    const publishedSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const now = Date.now();
    const hour = 60 * 60 * 1000;
    const windows = [
      { publishedFrom: new Date(now - 24 * hour), staleBefore: new Date(now - hour) },
      {
        publishedFrom: new Date(now - 7 * 24 * hour),
        publishedTo: new Date(now - 24 * hour),
        staleBefore: new Date(now - 6 * hour),
      },
      {
        publishedFrom: new Date(now - 30 * 24 * hour),
        publishedTo: new Date(now - 7 * 24 * hour),
        staleBefore: new Date(now - 24 * hour),
      },
    ];

    const auto = await analyticsRepository.findSchedulesToSync({
      workspaceId: wsId,
      publishedSince,
      refreshWindows: windows,
      take: 50,
    });
    const forced = await analyticsRepository.findSchedulesToSync({
      workspaceId: wsId,
      publishedSince,
      refreshWindows: null,
      take: 50,
    });

    expect(auto).toHaveLength(0);
    expect(forced).toHaveLength(2);
  });

  it('chặn người ngoài workspace đọc số liệu', async () => {
    const res = await request(app)
      .get(`/api/v1/workspaces/${wsId}/analytics/overview?range=7d`)
      .set('Authorization', `Bearer ${outsiderToken}`);

    expect(res.status).toBe(403);
  });

  it('gợi ý nội dung chỉ dựa trên bài của workspace hiện tại', async () => {
    const res = await request(app)
      .get(`/api/v1/workspaces/${wsId}/analytics/suggestions`)
      .set('Authorization', `Bearer ${creatorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.usedFallback).toBe(true);
    expect(res.body.data.bestTimes).toHaveLength(3);

    expect(res.body.data.sampleSize).toBe(2);
  });

  it('từ chối khoảng thời gian không hợp lệ', async () => {
    const res = await request(app)
      .get(`/api/v1/workspaces/${wsId}/analytics/overview?range=abc`)
      .set('Authorization', `Bearer ${creatorToken}`);

    expect(res.status).toBe(422);
  });
});
