import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import prisma from '../../../src/config/db.js';
import { encrypt } from '../../../src/utils/encryption.js';
import { facebookProvider } from '../../../src/modules/channel/providers/facebook.provider.js';
import { SocialTokenExpiredError } from '../../../src/modules/channel/providers/social-provider.js';

const password = 'password123';
const content = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nội dung' }] }],
};

describe('Hồ sơ kênh — chi tiết, đổi tên nội bộ, làm mới từ Facebook', () => {
  const stamp = Date.now();
  const owner = { email: `test_channel_profile_${stamp}@marka.vn`, name: 'Owner Channel Profile' };
  const outsider = { email: `test_channel_profile_out_${stamp}@marka.vn`, name: 'Outsider' };

  let token = '';
  let outsiderToken = '';
  let wsId = '';
  let channelId = '';
  let pageId = '';
  let ownerId = '';

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [owner.email, outsider.email] } } });

    const ownerRes = await request(app).post('/api/v1/auth/register').send({ ...owner, password });
    ownerId = ownerRes.body.data.user.id;
    token = ownerRes.body.data.accessToken;
    wsId = ownerRes.body.data.user.workspaces[0].id;

    const outsiderRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...outsider, password });
    outsiderToken = outsiderRes.body.data.accessToken;

    pageId = `channel-profile-${stamp}`;
    const channel = await prisma.channelConnection.create({
      data: {
        workspaceId: wsId,
        platform: 'FACEBOOK',
        type: 'REAL',
        name: 'Page ban đầu',
        externalAccountId: pageId,
        accessToken: encrypt('page-token') as string,
        status: 'ACTIVE',
      },
    });
    channelId = channel.id;

    const post = await prisma.post.create({
      data: { workspaceId: wsId, title: 'Bài đã đăng', content, status: 'PUBLISHED', createdById: ownerId },
    });
    const schedule = await prisma.scheduledPost.create({
      data: {
        postId: post.id,
        channelId,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        externalPostId: `fb-${post.id}`,
      },
    });
    await prisma.postMetric.create({
      data: {
        scheduledPostId: schedule.id,
        reactions: 10,
        comments: 2,
        shares: 1,
        impressions: 1000,
        reach: 800,
        fetchedAt: new Date(),
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('trả chi tiết kênh kèm thống kê tổng hợp', async () => {
    const res = await request(app)
      .get(`/api/v1/workspaces/${wsId}/channels/${channelId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.channel).toMatchObject({ id: channelId, label: null, name: 'Page ban đầu' });
    expect(res.body.data.stats).toMatchObject({
      publishedPosts: 1,
      reactions: 10,
      comments: 2,
      shares: 1,
      impressions: 1000,
      reach: 800,
    });
    expect(res.body.data.stats.lastPublishedAt).toBeTruthy();
  });

  it('đổi tên hiển thị nội bộ mà không đổi tên Page', async () => {
    const res = await request(app)
      .patch(`/api/v1/workspaces/${wsId}/channels/${channelId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'Page chính' });

    expect(res.status).toBe(200);
    expect(res.body.data.channel).toMatchObject({ label: 'Page chính', name: 'Page ban đầu' });

    const list = await request(app)
      .get(`/api/v1/workspaces/${wsId}/channels`)
      .set('Authorization', `Bearer ${token}`);
    expect(list.body.data.channels[0].label).toBe('Page chính');
  });

  it('làm mới tên và avatar từ Facebook', async () => {
    vi.spyOn(facebookProvider, 'fetchProfile').mockResolvedValue({
      id: pageId,
      name: 'Page sau khi làm mới',
      avatar: 'https://platform-lookaside.fbsbx.com/avatar.png',
    });

    const res = await request(app)
      .post(`/api/v1/workspaces/${wsId}/channels/${channelId}/refresh`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.channel).toMatchObject({
      name: 'Page sau khi làm mới',
      avatar: 'https://platform-lookaside.fbsbx.com/avatar.png',
      label: 'Page chính',
    });
  });

  it('đánh dấu kênh hết hạn khi token bị thu hồi', async () => {
    vi.spyOn(facebookProvider, 'fetchProfile').mockRejectedValue(new SocialTokenExpiredError());

    const res = await request(app)
      .post(`/api/v1/workspaces/${wsId}/channels/${channelId}/refresh`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);

    const channel = await prisma.channelConnection.findUnique({ where: { id: channelId } });
    expect(channel?.status).toBe('EXPIRED');
  });

  it('chặn người ngoài workspace xem chi tiết kênh', async () => {
    const res = await request(app)
      .get(`/api/v1/workspaces/${wsId}/channels/${channelId}`)
      .set('Authorization', `Bearer ${outsiderToken}`);

    expect(res.status).toBe(403);
  });
});
