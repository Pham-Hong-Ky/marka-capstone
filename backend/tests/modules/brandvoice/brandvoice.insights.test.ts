import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import prisma from '../../../src/config/db.js';

const password = 'password123';
const DAY_MS = 24 * 60 * 60 * 1000;

const content = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

describe('Brand Voice Insights', () => {
  const stamp = Date.now();
  const owner = { email: `test_bv_insight_owner_${stamp}@marka.vn`, name: 'Owner Insight' };
  const creator = { email: `test_bv_insight_creator_${stamp}@marka.vn`, name: 'Creator Insight' };
  const outsider = { email: `test_bv_insight_outsider_${stamp}@marka.vn`, name: 'Outsider Insight' };

  let ownerToken = '';
  let creatorToken = '';
  let outsiderToken = '';
  let ownerId = '';
  let wsId = '';
  let outsiderWorkspaceId = '';
  let channelId = '';

  const url = (workspaceId = wsId) => `/api/v1/workspaces/${workspaceId}/brand-voice/insights`;

  const createPublishedPost = async ({
    index,
    text,
    reactions,
    comments,
    shares,
    media = false,
  }: {
    index: number;
    text: string;
    reactions: number;
    comments: number;
    shares: number;
    media?: boolean;
  }) => {
    const post = await prisma.post.create({
      data: {
        workspaceId: wsId,
        title: `Bài insight ${index}`,
        content: content(text),
        status: 'PUBLISHED',
        createdById: ownerId,
      },
    });

    if (media) {
      await prisma.mediaAsset.create({
        data: {
          workspaceId: wsId,
          postId: post.id,
          url: `https://res.cloudinary.com/demo/image/upload/insight-${index}.png`,
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
        channelId,
        status: 'PUBLISHED',
        publishedAt: new Date(Date.now() - (index + 3) * DAY_MS),
        externalPostId: `fb-insight-${post.id}`,
      },
    });

    await prisma.postMetric.create({
      data: {
        scheduledPostId: schedule.id,
        reactions,
        comments,
        shares,
        impressions: 1000,
        fetchedAt: new Date(),
      },
    });
  };

  beforeAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [owner.email, creator.email, outsider.email] } },
    });

    const ownerRes = await request(app).post('/api/v1/auth/register').send({ ...owner, password });
    ownerId = ownerRes.body.data.user.id;
    ownerToken = ownerRes.body.data.accessToken;
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

    const channel = await prisma.channelConnection.create({
      data: {
        workspaceId: wsId,
        platform: 'FACEBOOK',
        type: 'REAL',
        name: 'Page Insight',
        externalAccountId: `page-insight-${stamp}`,
        status: 'ACTIVE',
      },
    });
    channelId = channel.id;

    for (let index = 0; index < 5; index += 1) {
      await createPublishedPost({
        index,
        text: `Bạn có biết bí quyết chọn sơ mi ${index}? Đây là cách phối đồ đơn giản. Bình luận ngay nhé!`,
        reactions: 100 + index,
        comments: 20,
        shares: 5,
        media: true,
      });
    }

    for (let index = 5; index < 10; index += 1) {
      await createPublishedPost({
        index,
        text: `Hôm nay trời đẹp ${index}. Chúng tôi giới thiệu sản phẩm mới của thương hiệu.`,
        reactions: 5,
        comments: 1,
        shares: 0,
      });
    }

    for (let index = 10; index < 12; index += 1) {
      await createPublishedPost({
        index,
        text: `Một chiếc sơ mi trắng đủ cho cả tuần đi làm ${index}.`,
        reactions: 50,
        comments: 2,
        shares: 1,
      });
    }
  });

  afterAll(async () => {
    await prisma.workspace.deleteMany({
      where: { id: { in: [wsId, outsiderWorkspaceId].filter(Boolean) } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [owner.email, creator.email, outsider.email] } },
    });
  });

  it('Owner xem insight: top bài, bài học và gợi ý Brand Voice', async () => {
    const res = await request(app)
      .get(url())
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.meta.sampleSize).toBe(12);
    expect(res.body.data.meta.usedFallback).toBe(false);
    expect(res.body.data.topPosts).toHaveLength(5);
    expect(res.body.data.topPosts[0].totalInteractions).toBeGreaterThanOrEqual(
      res.body.data.topPosts[1].totalInteractions
    );

    const insightIds = res.body.data.insights.map((insight: { id: string }) => insight.id);
    expect(insightIds).toContain('hook_question');
    expect(insightIds).toContain('cta');

    expect(res.body.data.suggestedBrandVoice.fewShotExamples).toHaveLength(3);
    expect(res.body.data.suggestedBrandVoice.writingStyle.length).toBeLessThanOrEqual(300);
    expect(res.body.data.suggestedBrandVoice.writingStyle.length).toBeGreaterThan(0);
  });

  it('bỏ bài mới đăng dưới 48 giờ để số liệu ổn định', async () => {
    const recentPost = await prisma.post.create({
      data: {
        workspaceId: wsId,
        title: 'Bài mới đăng',
        content: content('Bạn có biết bài này vừa đăng? Bình luận ngay nhé!'),
        status: 'PUBLISHED',
        createdById: ownerId,
      },
    });
    const recentSchedule = await prisma.scheduledPost.create({
      data: {
        postId: recentPost.id,
        channelId,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        externalPostId: `fb-recent-${recentPost.id}`,
      },
    });
    await prisma.postMetric.create({
      data: {
        scheduledPostId: recentSchedule.id,
        reactions: 9999,
        comments: 9999,
        shares: 9999,
        impressions: 1000,
        fetchedAt: new Date(),
      },
    });

    const res = await request(app)
      .get(url())
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.meta.sampleSize).toBe(12);
    expect(res.body.data.topPosts.map((post: { id: string }) => post.id)).not.toContain(
      recentPost.id
    );

    await prisma.post.delete({ where: { id: recentPost.id } });
  });

  it('Creator được xem insight (200)', async () => {
    const res = await request(app)
      .get(url())
      .set('Authorization', `Bearer ${creatorToken}`);

    expect(res.status).toBe(200);
  });

  it('Người ngoài workspace không xem được insight (403)', async () => {
    const res = await request(app)
      .get(url())
      .set('Authorization', `Bearer ${outsiderToken}`);

    expect(res.status).toBe(403);
  });

  it('Workspace chưa có bài trả về trạng thái chưa đủ dữ liệu', async () => {
    const res = await request(app)
      .get(url(outsiderWorkspaceId))
      .set('Authorization', `Bearer ${outsiderToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.meta.sampleSize).toBe(0);
    expect(res.body.data.meta.usedFallback).toBe(true);
    expect(res.body.data.topPosts).toEqual([]);
    expect(res.body.data.insights).toEqual([]);
  });

  it('Workspace không tồn tại trả 404', async () => {
    const res = await request(app)
      .get(url('00000000-0000-4000-8000-000000000000'))
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(404);
  });

  it('Validate limit vượt 10 trả 422', async () => {
    const res = await request(app)
      .get(url())
      .query({ limit: 50 })
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(422);
  });

  it('Validate windowDays nhỏ hơn 7 trả 422', async () => {
    const res = await request(app)
      .get(url())
      .query({ windowDays: 1 })
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(422);
  });
});
