import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import prisma from '../../../src/config/db.js';

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

    const tips = res.body.data.contentTips as Array<{ postId: string; rule: string }>;
    expect(tips.some((tip) => tip.rule === 'no_media')).toBe(true);
    expect(tips.every((tip) => tip.postId !== undefined)).toBe(true);
    expect(res.body.data.sampleSize).toBe(2);
  });

  it('từ chối khoảng thời gian không hợp lệ', async () => {
    const res = await request(app)
      .get(`/api/v1/workspaces/${wsId}/analytics/overview?range=abc`)
      .set('Authorization', `Bearer ${creatorToken}`);

    expect(res.status).toBe(422);
  });
});
