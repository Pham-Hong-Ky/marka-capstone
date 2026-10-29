import { afterEach, beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import prisma from '../../../src/config/db.js';
import { decrypt } from '../../../src/utils/encryption.js';

const password = 'password123';

const threadsEnv = vi.hoisted(() => {
  const redirectUri = 'http://localhost:5000/api/v1/channels/threads/oauth/callback';
  process.env.THREADS_APP_ID = 'threads-app-id';
  process.env.THREADS_APP_SECRET = 'threads-app-secret';
  process.env.THREADS_REDIRECT_URI = redirectUri;
  // Test "state của nền tảng khác" cần tạo state Facebook; CI không có key thật.
  process.env.FACEBOOK_APP_ID = 'facebook-app-id';
  process.env.FACEBOOK_APP_SECRET = 'facebook-app-secret';
  process.env.FACEBOOK_REDIRECT_URI = 'http://localhost:5000/api/v1/channels/facebook/oauth/callback';
  return { redirectUri };
});

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const mockThreads = () => {
  const fetchMock = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input));
    if (url.pathname === '/oauth/access_token') {
      return jsonResponse({ access_token: 'short-token', user_id: 'threads-user-1' });
    }
    if (url.pathname === '/access_token') {
      return jsonResponse({ access_token: 'long-token', expires_in: 5_183_944 });
    }
    if (url.pathname.endsWith('/me')) {
      return jsonResponse({
        id: 'threads-user-1',
        username: 'marka.test',
        name: '',
        threads_profile_picture_url: 'https://example.com/threads.png',
      });
    }
    throw new Error(`Unexpected Threads URL: ${url.toString()}`);
  });

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

describe('Threads OAuth', () => {
  const stamp = Date.now();
  const owner = { email: `test_threads_owner_${stamp}@marka.vn`, name: 'Threads Owner' };
  let ownerToken = '';
  let wsId = '';

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: owner.email } });

    const res = await request(app).post('/api/v1/auth/register').send({ ...owner, password });
    ownerToken = res.body.data.accessToken;
    wsId = res.body.data.user.workspaces[0].id;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: owner.email } });
  });

  const createState = async (platform = 'THREADS'): Promise<string> => {
    const res = await request(app)
      .get(`/api/v1/channels/${platform}/oauth/url?workspaceId=${wsId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    return new URL(res.body.data.url).searchParams.get('state') as string;
  };

  it('tạo URL authorize đúng scope Threads', async () => {
    const res = await request(app)
      .get(`/api/v1/channels/THREADS/oauth/url?workspaceId=${wsId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    const url = new URL(res.body.data.url);
    expect(url.origin + url.pathname).toBe('https://threads.com/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('threads-app-id');
    expect(url.searchParams.get('redirect_uri')).toBe(threadsEnv.redirectUri);
    expect(url.searchParams.get('scope')).toBe(
      'threads_basic,threads_content_publish,threads_manage_insights'
    );
  });

  it('callback upsert ngay một tài khoản, không tạo session', async () => {
    const state = await createState();
    mockThreads();

    const res = await request(app).get(
      `/api/v1/channels/THREADS/oauth/callback?code=test-code&state=${state}`
    );

    expect(res.status).toBe(302);
    const location = new URL(res.headers.location as string);
    expect(location.searchParams.get('connected')).toBe('THREADS');
    expect(location.searchParams.get('session')).toBeNull();

    const row = await prisma.channelConnection.findFirst({ where: { workspaceId: wsId } });
    expect(row).toMatchObject({
      platform: 'THREADS',
      type: 'REAL',
      status: 'ACTIVE',
      externalAccountId: 'threads-user-1',
      name: '@marka.test',
      avatar: 'https://example.com/threads.png',
    });
    expect(decrypt(row?.accessToken)).toBe('long-token');
  });

  it('kết nối lại cùng tài khoản giữ nguyên channel id và cập nhật token', async () => {
    const first = await prisma.channelConnection.findFirst({ where: { workspaceId: wsId } });
    const state = await createState();
    mockThreads();

    const res = await request(app).get(
      `/api/v1/channels/THREADS/oauth/callback?code=test-code&state=${state}`
    );
    expect(res.status).toBe(302);

    const rows = await prisma.channelConnection.findMany({ where: { workspaceId: wsId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(first?.id);
  });

  it('state của nền tảng khác bị từ chối', async () => {
    const state = await createState('FACEBOOK');

    const res = await request(app).get(
      `/api/v1/channels/THREADS/oauth/callback?code=x&state=${state}`
    );

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('connect_error=invalid_state');
  });

  it('danh sách kênh không trả token', async () => {
    const res = await request(app)
      .get(`/api/v1/workspaces/${wsId}/channels`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', wsId);

    expect(res.status).toBe(200);
    const channel = res.body.data.channels.find(
      (item: { platform: string }) => item.platform === 'THREADS'
    );
    expect(channel.accessToken).toBeUndefined();
    expect(channel.externalAccountId).toBe('threads-user-1');
  });
});
