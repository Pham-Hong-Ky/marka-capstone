import { afterEach, describe, expect, it, vi } from 'vitest';
import { facebookProvider } from '../../../src/modules/channel/providers/facebook.provider.js';
import { SocialTokenExpiredError } from '../../../src/modules/channel/providers/social-provider.js';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const postInsights = (body: unknown, status = 200) => jsonResponse(body, status);

describe('FacebookProvider.fetchMetrics', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('đọc được cảm xúc, bình luận, chia sẻ, impressions và reach', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          reactions: { summary: { total_count: 42 } },
          comments: { summary: { total_count: 7 } },
          shares: { count: 3 },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            { name: 'post_impressions', values: [{ value: 5000 }] },
            { name: 'post_impressions_unique', values: [{ value: 3200 }] },
            {
              name: 'post_reactions_by_type_total',
              values: [{ value: { like: 40, love: 2 } }],
            },
          ],
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    const metrics = await facebookProvider.fetchMetrics('123_456', 'page-token');

    expect(metrics).toEqual({
      reactions: 42,
      comments: 7,
      shares: 3,
      impressions: 5000,
      reach: 3200,
      reactionsDetail: { like: 40, love: 2 },
      partialError: null,
    });
  });

  it('vẫn trả số liệu tương tác khi Facebook từ chối insights', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ reactions: { summary: { total_count: 5 } } }))
      .mockResolvedValueOnce(
        postInsights({ error: { code: 10, message: 'Permission denied' } }, 400)
      );
    vi.stubGlobal('fetch', fetchMock);

    const metrics = await facebookProvider.fetchMetrics('123_456', 'page-token');

    expect(metrics.impressions).toBeNull();
    expect(metrics.reach).toBeNull();
    expect(metrics.partialError).toContain('quyền');
  });

  it('ném lỗi token hết hạn để lớp trên xử lý kênh', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ error: { code: 190, message: 'Invalid token' } }, 401)
      )
    );

    await expect(facebookProvider.fetchMetrics('123_456', 'page-token')).rejects.toBeInstanceOf(
      SocialTokenExpiredError
    );
  });

  it('mặc định 0 khi Facebook không trả trường tương tác', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({ data: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const metrics = await facebookProvider.fetchMetrics('123_456', 'page-token');

    expect(metrics.reactions).toBe(0);
    expect(metrics.comments).toBe(0);
    expect(metrics.shares).toBe(0);
    expect(metrics.impressions).toBeNull();
  });
});
