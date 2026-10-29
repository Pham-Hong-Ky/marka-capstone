import { afterEach, describe, expect, it, vi } from 'vitest';
import { threadsProvider } from '../../../src/modules/channel/providers/threads.provider.js';
import { SocialTokenExpiredError } from '../../../src/modules/channel/providers/social-provider.js';

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

describe('ThreadsProvider.fetchMetrics', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('map likes/replies/reposts/quotes/shares/views sang PostMetric', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          data: [
            { name: 'views', values: [{ value: 1000 }] },
            { name: 'likes', values: [{ value: 42 }] },
            { name: 'replies', values: [{ value: 7 }] },
            { name: 'reposts', values: [{ value: 3 }] },
            { name: 'quotes', values: [{ value: 2 }] },
            { name: 'shares', values: [{ value: 1 }] },
          ],
        })
      )
    );

    const metrics = await threadsProvider.fetchMetrics('threads-post-1', 'long-token');

    expect(metrics).toEqual({
      reactions: 42,
      comments: 7,
      shares: 6,
      impressions: 1000,
      reach: null,
      reactionsDetail: null,
      partialError: null,
    });
  });

  it('fallback khi views/shares chưa được hỗ trợ', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: { message: 'Unsupported metric' } }, 400))
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            { name: 'likes', values: [{ value: 5 }] },
            { name: 'replies', values: [{ value: 2 }] },
            { name: 'reposts', values: [{ value: 1 }] },
            { name: 'quotes', values: [{ value: 4 }] },
          ],
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    const metrics = await threadsProvider.fetchMetrics('threads-post-1', 'long-token');

    expect(metrics).toEqual({
      reactions: 5,
      comments: 2,
      shares: 5,
      impressions: null,
      reach: null,
      reactionsDetail: null,
      partialError: expect.stringContaining('Unsupported metric'),
    });
    const retryUrl = new URL(String(fetchMock.mock.calls[1][0]));
    expect(retryUrl.searchParams.get('metric')).toBe('likes,replies,reposts,quotes');
  });

  it('token hết hạn map thành SocialTokenExpiredError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        jsonResponse({ error: { code: 190, message: 'Session has expired' } }, 400)
      )
    );

    await expect(
      threadsProvider.fetchMetrics('threads-post-1', 'long-token')
    ).rejects.toBeInstanceOf(SocialTokenExpiredError);
  });
});
