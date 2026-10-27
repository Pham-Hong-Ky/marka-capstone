import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import prisma, { basePrisma } from '../../../src/config/db.js';
import { decrypt } from '../../../src/utils/encryption.js';

const password = 'password123';

const fbEnv = vi.hoisted(() => {
  const redirectUri = 'http://localhost:5000/api/v1/channels/facebook/oauth/callback';
  process.env.FACEBOOK_APP_ID = 'test-app-id';
  process.env.FACEBOOK_APP_SECRET = 'test-app-secret';
  process.env.FACEBOOK_REDIRECT_URI = redirectUri;
  return { redirectUri };
});

describe('Channel (UC27, UC28, UC29)', () => {
  const stamp = Date.now();
  const owner = { email: `test_ch_owner_${stamp}@marka.vn`, name: 'Owner Channel' };
  const creator = { email: `test_ch_creator_${stamp}@marka.vn`, name: 'Creator Channel' };
  const outsider = { email: `test_ch_outsider_${stamp}@marka.vn`, name: 'Outsider Channel' };

  let ownerToken = '';
  let creatorToken = '';
  let outsiderToken = '';
  let wsId = '';
  let creatorId = '';
  let outsiderWorkspaceId = '';

  const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  const mockFacebook = (pages: unknown[] = [
    {
      id: 'page-1',
      name: 'Page Một',
      access_token: 'page-token-1',
      picture: { data: { url: 'https://example.com/page-1.png' } },
    },
  ]) => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/oauth/access_token')) {
        const grantType = url.searchParams.get('grant_type');
        return jsonResponse({ access_token: grantType ? 'long-user-token' : 'short-user-token' });
      }
      if (url.pathname.endsWith('/me/accounts')) {
        return jsonResponse({ data: pages });
      }
      throw new Error(`Unexpected Facebook URL: ${url.toString()}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  };

  const createOauthState = async (): Promise<string> => {
    const res = await request(app)
      .get(`/api/v1/channels/facebook/oauth/url?workspaceId=${wsId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    return new URL(res.body.data.url).searchParams.get('state') as string;
  };

  const createOauthSession = async (pages?: unknown[]): Promise<string> => {
    const state = await createOauthState();
    mockFacebook(pages);

    const res = await request(app).get(
      `/api/v1/channels/facebook/oauth/callback?code=test-code&state=${state}`
    );

    expect(res.status).toBe(302);
    return new URL(res.headers.location as string).searchParams.get('session') as string;
  };

  beforeAll(async () => {
    const emails = [owner.email, creator.email, outsider.email];
    await prisma.user.deleteMany({ where: { email: { in: emails } } });

    const ownerRes = await request(app).post('/api/v1/auth/register').send({ ...owner, password });
    ownerToken = ownerRes.body.data.accessToken;
    wsId = ownerRes.body.data.user.workspaces[0].id;

    const creatorRes = await request(app).post('/api/v1/auth/register').send({ ...creator, password });
    creatorToken = creatorRes.body.data.accessToken;
    creatorId = creatorRes.body.data.user.id;
    await prisma.workspaceMember.create({
      data: { workspaceId: wsId, userId: creatorId, role: 'CONTENT_CREATOR' },
    });

    const outsiderRes = await request(app).post('/api/v1/auth/register').send({ ...outsider, password });
    outsiderToken = outsiderRes.body.data.accessToken;
    outsiderWorkspaceId = outsiderRes.body.data.user.workspaces[0].id;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    await prisma.workspace.deleteMany({
      where: { id: { in: [wsId, outsiderWorkspaceId].filter(Boolean) } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [owner.email, creator.email, outsider.email] } },
    });
  });

  it('UC27 — Creator xem danh sách kênh, không lộ accessToken', async () => {
    const res = await request(app)
      .get(`/api/v1/workspaces/${wsId}/channels`)
      .set('Authorization', `Bearer ${creatorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.channels).toEqual([]);
  });

  it('UC27 — Outsider không xem được kênh workspace khác', async () => {
    const res = await request(app)
      .get(`/api/v1/workspaces/${wsId}/channels`)
      .set('Authorization', `Bearer ${outsiderToken}`);

    expect(res.status).toBe(403);
  });

  it('UC28 — Owner lấy URL đăng nhập Facebook', async () => {
    const res = await request(app)
      .get(`/api/v1/channels/facebook/oauth/url?workspaceId=${wsId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    const url = new URL(res.body.data.url);
    expect(url.hostname).toBe('www.facebook.com');
    expect(url.searchParams.get('client_id')).toBe('test-app-id');
    expect(url.searchParams.get('redirect_uri')).toBe(fbEnv.redirectUri);
    expect(url.searchParams.get('scope')).toContain('pages_show_list');
  });

  it('UC28 — Creator không lấy được URL đăng nhập Facebook', async () => {
    const res = await request(app)
      .get(`/api/v1/channels/facebook/oauth/url?workspaceId=${wsId}`)
      .set('Authorization', `Bearer ${creatorToken}`);

    expect(res.status).toBe(403);
  });

  it('UC28 — Callback tạo session và redirect về trang chọn Page', async () => {
    const state = await createOauthState();
    const fetchMock = mockFacebook();

    const res = await request(app).get(
      `/api/v1/channels/facebook/oauth/callback?code=test-code&state=${state}`
    );

    expect(res.status).toBe(302);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const location = new URL(res.headers.location as string);
    expect(location.pathname).toBe('/channels');
    expect(location.searchParams.get('fb')).toBe('select');
    expect(location.searchParams.get('session')).toMatch(/^[a-f0-9]{48}$/);
  });

  it('UC28 — State sai bị từ chối', async () => {
    const res = await request(app).get(
      '/api/v1/channels/facebook/oauth/callback?code=x&state=bad'
    );

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('reason=invalid_state');
  });

  it('UC28 — State dùng lại lần hai bị từ chối', async () => {
    const state = await createOauthState();
    mockFacebook();

    const first = await request(app).get(
      `/api/v1/channels/facebook/oauth/callback?code=x&state=${state}`
    );
    const second = await request(app).get(
      `/api/v1/channels/facebook/oauth/callback?code=x&state=${state}`
    );

    expect(first.headers.location).toContain('fb=select');
    expect(second.headers.location).toContain('reason=invalid_state');
  });

  it('UC28 — Người dùng từ chối cấp quyền được báo lỗi', async () => {
    const state = await createOauthState();

    const res = await request(app).get(
      `/api/v1/channels/facebook/oauth/callback?error=access_denied&state=${state}`
    );

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('reason=access_denied');
  });

  it('UC28 — Tài khoản không có Page nào trả no_pages', async () => {
    const state = await createOauthState();
    mockFacebook([]);

    const res = await request(app).get(
      `/api/v1/channels/facebook/oauth/callback?code=x&state=${state}`
    );

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('reason=no_pages');
  });

  it('UC28 — Owner xem danh sách Page chờ chọn, không có token', async () => {
    const sessionId = await createOauthSession();

    const res = await request(app)
      .get(`/api/v1/channels/facebook/oauth/session/${sessionId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', wsId);

    expect(res.status).toBe(200);
    expect(res.body.data.pages).toEqual([
      { id: 'page-1', name: 'Page Một', avatar: 'https://example.com/page-1.png' },
    ]);
  });

  it('UC28 — Người khác không đọc được session chọn Page', async () => {
    const sessionId = await createOauthSession();

    const res = await request(app)
      .get(`/api/v1/channels/facebook/oauth/session/${sessionId}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .set('x-workspace-id', outsiderWorkspaceId);

    expect(res.status).toBe(404);
  });

  it('UC28 — Chọn Page lưu token đã mã hoá, không trả token', async () => {
    const sessionId = await createOauthSession();

    const res = await request(app)
      .post(`/api/v1/channels/facebook/oauth/session/${sessionId}/connect`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', wsId)
      .send({ pageIds: ['page-1'] });

    expect(res.status).toBe(201);
    expect(res.body.data.channels[0].name).toBe('Page Một');
    expect(res.body.data.channels[0].accessToken).toBeUndefined();

    const row = await prisma.channelConnection.findFirst({ where: { workspaceId: wsId } });
    expect(row?.accessToken).not.toBe('page-token-1');
    expect(decrypt(row?.accessToken)).toBe('page-token-1');
  });

  it('UC28 — Page không thuộc session bị từ chối', async () => {
    const sessionId = await createOauthSession();

    const res = await request(app)
      .post(`/api/v1/channels/facebook/oauth/session/${sessionId}/connect`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', wsId)
      .send({ pageIds: ['page-khac'] });

    expect(res.status).toBe(400);
    const row = await prisma.channelConnection.findFirst({
      where: { workspaceId: wsId, externalAccountId: 'page-khac' },
    });
    expect(row).toBeNull();
  });

  it('UC28 — Bỏ Page thiếu access_token khỏi danh sách chọn', async () => {
    const sessionId = await createOauthSession([
      {
        id: 'page-3',
        name: 'Page Có Token',
        access_token: 'page-token-3',
        picture: { data: { url: 'https://example.com/page-3.png' } },
      },
      {
        id: 'page-4',
        name: 'Page Thiếu Token',
        picture: { data: { url: 'https://example.com/page-4.png' } },
      },
    ]);

    const res = await request(app)
      .get(`/api/v1/channels/facebook/oauth/session/${sessionId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', wsId);

    expect(res.status).toBe(200);
    expect(res.body.data.pages).toEqual([
      { id: 'page-3', name: 'Page Có Token', avatar: 'https://example.com/page-3.png' },
    ]);
  });

  it('UC28 — Lưu được avatar URL dài hơn 255 ký tự', async () => {
    const longAvatar = `https://scontent.example.com/${'a'.repeat(300)}.jpg`;
    const sessionId = await createOauthSession([
      {
        id: 'page-long-avatar',
        name: 'Page Avatar Dài',
        access_token: 'page-token-long-avatar',
        picture: { data: { url: longAvatar } },
      },
    ]);

    const res = await request(app)
      .post(`/api/v1/channels/facebook/oauth/session/${sessionId}/connect`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', wsId)
      .send({ pageIds: ['page-long-avatar'] });

    expect(res.status).toBe(201);
    expect(res.body.data.channels[0].avatar).toBe(longAvatar);

    const row = await prisma.channelConnection.findFirst({
      where: { workspaceId: wsId, externalAccountId: 'page-long-avatar' },
    });
    expect(row?.avatar).toBe(longAvatar);
  });

  it('UC28 — URL lấy workspace từ header, không dùng query lệch', async () => {
    const urlRes = await request(app)
      .get(`/api/v1/channels/facebook/oauth/url?workspaceId=${outsiderWorkspaceId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', wsId);

    expect(urlRes.status).toBe(200);

    const state = new URL(urlRes.body.data.url).searchParams.get('state') as string;
    mockFacebook();
    const callback = await request(app).get(
      `/api/v1/channels/facebook/oauth/callback?code=x&state=${state}`
    );
    const sessionId = new URL(callback.headers.location as string).searchParams.get(
      'session'
    ) as string;

    const res = await request(app)
      .get(`/api/v1/channels/facebook/oauth/session/${sessionId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', wsId);

    expect(res.status).toBe(200);
  });

  it('UC28 — Creator không được kết nối Page', async () => {
    const sessionId = await createOauthSession();

    const res = await request(app)
      .post(`/api/v1/channels/facebook/oauth/session/${sessionId}/connect`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .set('x-workspace-id', wsId)
      .send({ pageIds: ['page-1'] });

    expect(res.status).toBe(403);
  });

  it('UC28 — Kết nối lại cùng Page giữ nguyên channel id', async () => {
    const firstSession = await createOauthSession();
    const first = await request(app)
      .post(`/api/v1/channels/facebook/oauth/session/${firstSession}/connect`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', wsId)
      .send({ pageIds: ['page-1'] });

    const secondSession = await createOauthSession([
      {
        id: 'page-1',
        name: 'Page Một mới',
        access_token: 'page-token-2',
        picture: { data: { url: 'https://example.com/page-1-new.png' } },
      },
    ]);
    const second = await request(app)
      .post(`/api/v1/channels/facebook/oauth/session/${secondSession}/connect`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', wsId)
      .send({ pageIds: ['page-1'] });

    expect(second.status).toBe(201);
    expect(second.body.data.channels[0].id).toBe(first.body.data.channels[0].id);
    expect(second.body.data.channels[0].name).toBe('Page Một mới');

    const row = await prisma.channelConnection.findFirst({
      where: { workspaceId: wsId, externalAccountId: 'page-1' },
    });
    expect(decrypt(row?.accessToken)).toBe('page-token-2');
  });

  it('UC28 — Session bị xoá sau khi kết nối', async () => {
    const sessionId = await createOauthSession();
    await request(app)
      .post(`/api/v1/channels/facebook/oauth/session/${sessionId}/connect`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', wsId)
      .send({ pageIds: ['page-1'] });

    const res = await request(app)
      .get(`/api/v1/channels/facebook/oauth/session/${sessionId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', wsId);

    expect(res.status).toBe(404);
  });

  it('UC29 — Creator không được ngắt kết nối', async () => {
    const channel = await prisma.channelConnection.findFirstOrThrow({
      where: { workspaceId: wsId, externalAccountId: 'page-1' },
    });

    const res = await request(app)
      .delete(`/api/v1/channels/${channel.id}`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .set('x-workspace-id', wsId);

    expect(res.status).toBe(403);
  });

  it('UC29 — Ngắt kết nối huỷ lịch chờ nhưng giữ lịch sử', async () => {
    const channel = await prisma.channelConnection.findFirstOrThrow({
      where: { workspaceId: wsId, externalAccountId: 'page-1' },
    });
    const post = await prisma.post.create({
      data: { workspaceId: wsId, title: 'Bài lên lịch', content: {}, status: 'SCHEDULED' },
    });
    const scheduled = await prisma.scheduledPost.create({
      data: {
        postId: post.id,
        channelId: channel.id,
        scheduledAt: new Date(Date.now() + 3_600_000),
        status: 'SCHEDULED',
      },
    });
    const publishedPost = await prisma.post.create({
      data: { workspaceId: wsId, title: 'Bài đã đăng', content: {}, status: 'PUBLISHED' },
    });
    const published = await prisma.scheduledPost.create({
      data: {
        postId: publishedPost.id,
        channelId: channel.id,
        status: 'PUBLISHED',
        externalPostId: 'fb-post-1',
        publishedAt: new Date(),
      },
    });
    await prisma.postMetric.create({
      data: { scheduledPostId: published.id, reactions: 7, comments: 2 },
    });

    const res = await request(app)
      .delete(`/api/v1/channels/${channel.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', wsId);

    expect(res.status).toBe(200);
    expect(res.body.data.success).toBe(true);
    expect(await prisma.channelConnection.findUnique({ where: { id: channel.id } })).toBeNull();

    const row = await basePrisma.channelConnection.findUnique({ where: { id: channel.id } });
    expect(row?.deletedAt).not.toBeNull();
    expect(row?.accessToken).toBeNull();

    const schedule = await prisma.scheduledPost.findUnique({ where: { id: scheduled.id } });
    expect(schedule?.status).toBe('CANCELLED');
    expect(await prisma.scheduledPost.findUnique({ where: { id: published.id } })).not.toBeNull();
    expect(
      await prisma.postMetric.findUnique({ where: { scheduledPostId: published.id } })
    ).not.toBeNull();

    const savedPost = await prisma.post.findUnique({ where: { id: post.id } });
    expect(savedPost?.status).toBe('APPROVED');
  });

  it('UC29 — Kết nối lại Page sau khi ngắt khôi phục kênh cũ', async () => {
    const sessionId = await createOauthSession();
    const res = await request(app)
      .post(`/api/v1/channels/facebook/oauth/session/${sessionId}/connect`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', wsId)
      .send({ pageIds: ['page-1'] });

    expect(res.status).toBe(201);
    const row = await basePrisma.channelConnection.findFirst({
      where: { workspaceId: wsId, externalAccountId: 'page-1' },
    });
    expect(row?.deletedAt).toBeNull();
    expect(decrypt(row?.accessToken)).toBe('page-token-1');
  });

  it('UC29 — Không ngắt kết nối khi kênh đang đăng', async () => {
    const channel = await prisma.channelConnection.create({
      data: {
        workspaceId: wsId,
        platform: 'FACEBOOK',
        type: 'REAL',
        name: 'Page đang đăng',
        externalAccountId: `page-processing-${stamp}`,
        status: 'ACTIVE',
      },
    });
    const post = await prisma.post.create({
      data: { workspaceId: wsId, title: 'Bài đang đăng', content: {}, status: 'SCHEDULED' },
    });
    await prisma.scheduledPost.create({
      data: {
        postId: post.id,
        channelId: channel.id,
        status: 'PROCESSING',
        processingStartedAt: new Date(),
      },
    });

    const res = await request(app)
      .delete(`/api/v1/channels/${channel.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', wsId);

    expect(res.status).toBe(409);
    expect(await prisma.channelConnection.findUnique({ where: { id: channel.id } })).not.toBeNull();
  });

  it('UC29 — Thiếu workspace header bị từ chối', async () => {
    const res = await request(app)
      .delete('/api/v1/channels/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(400);
  });
});
