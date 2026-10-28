import { afterEach, beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import prisma from '../../../src/config/db.js';
import { decrypt, encrypt } from '../../../src/utils/encryption.js';
import { refreshChannelTokens } from '../../../src/modules/channel/channel.token-refresh.js';

vi.hoisted(() => {
  process.env.THREADS_APP_ID = 'threads-app-id';
  process.env.THREADS_APP_SECRET = 'threads-app-secret';
  process.env.THREADS_REDIRECT_URI =
    'http://localhost:5000/api/v1/channels/threads/oauth/callback';
});

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('channel token refresh', () => {
  const stamp = Date.now();
  const owner = { email: `test_token_refresh_${stamp}@marka.vn`, name: 'Token Refresh' };
  let wsId = '';

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: owner.email } });
    const res = await request(app).post('/api/v1/auth/register').send({ ...owner, password: 'password123' });
    wsId = res.body.data.user.workspaces[0].id;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: owner.email } });
  });

  const createChannel = async (platform: 'FACEBOOK' | 'THREADS', token: string) =>
    prisma.channelConnection.create({
      data: {
        workspaceId: wsId,
        platform,
        type: 'REAL',
        name: `${platform} ${Date.now()}`,
        externalAccountId: `${platform.toLowerCase()}-${Date.now()}-${Math.random()}`,
        accessToken: encrypt(token) as string,
        status: 'ACTIVE',
      },
    });

  it('refresh token Threads và lưu bản mã hoá mới', async () => {
    const channel = await createChannel('THREADS', 'old-threads-token');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = new URL(String(input));
        if (url.searchParams.get('access_token') === 'old-threads-token') {
          return jsonResponse({ access_token: 'new-threads-token', expires_in: 5_183_944 });
        }
        return jsonResponse({ error: { code: 190, message: 'expired' } }, 400);
      })
    );

    await refreshChannelTokens();

    const row = await prisma.channelConnection.findUnique({ where: { id: channel.id } });
    expect(decrypt(row?.accessToken)).toBe('new-threads-token');
    expect(row?.status).toBe('ACTIVE');
  });

  it('token hết hạn chuyển kênh sang EXPIRED', async () => {
    const channel = await createChannel('THREADS', 'expired-threads-token');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = new URL(String(input));
        if (url.searchParams.get('access_token') === 'expired-threads-token') {
          return jsonResponse({ error: { code: 190, message: 'expired' } }, 400);
        }
        return jsonResponse({ access_token: 'rotated', expires_in: 5_183_944 });
      })
    );

    await refreshChannelTokens();

    const row = await prisma.channelConnection.findUnique({ where: { id: channel.id } });
    expect(row?.status).toBe('EXPIRED');
  });

  it('token quá mới thì bỏ qua, không đánh dấu lỗi', async () => {
    const channel = await createChannel('THREADS', 'new-threads-token');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = new URL(String(input));
        if (url.searchParams.get('access_token') === 'new-threads-token') {
          return jsonResponse(
            { error: { code: 400, message: 'Token is too new; wait 24 hours' } },
            400
          );
        }
        return jsonResponse({ access_token: 'rotated', expires_in: 5_183_944 });
      })
    );

    const result = await refreshChannelTokens();

    const row = await prisma.channelConnection.findUnique({ where: { id: channel.id } });
    expect(row?.status).toBe('ACTIVE');
    expect(result.skipped).toBeGreaterThanOrEqual(1);
  });

  it('bỏ qua kênh Facebook', async () => {
    const channel = await createChannel('FACEBOOK', 'facebook-token');

    await refreshChannelTokens();

    const row = await prisma.channelConnection.findUnique({ where: { id: channel.id } });
    expect(decrypt(row?.accessToken)).toBe('facebook-token');
  });
});
