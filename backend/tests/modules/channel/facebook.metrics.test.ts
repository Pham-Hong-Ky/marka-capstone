import { afterEach, describe, expect, it, vi } from 'vitest';
import { facebookAdapter } from '../../../src/modules/channel/providers/facebook/facebook.adapter.js';
import { SocialTokenExpiredError } from '../../../src/modules/channel/providers/errors/social.errors.js';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const permissionDenied = () =>
  jsonResponse({ error: { code: 10, message: 'Permission denied' } }, 400);

type Route = 'shares' | 'reactions' | 'comments' | 'insights';

const routeOf = (rawUrl: string): Route => {
  const url = decodeURIComponent(rawUrl);
  if (url.includes('/insights')) return 'insights';
  if (url.includes('fields=reactions')) return 'reactions';
  if (url.includes('fields=comments')) return 'comments';
  return 'shares';
};

const stubGraph = (handlers: Record<Route, () => Response>) => {
  const fetchMock = vi.fn((input: unknown) => Promise.resolve(handlers[routeOf(String(input))]()));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const okHandlers: Record<Route, () => Response> = {
  shares: () => jsonResponse({ shares: { count: 3 } }),
  reactions: () => jsonResponse({ reactions: { summary: { total_count: 42 } } }),
  comments: () => jsonResponse({ comments: { summary: { total_count: 7 } } }),
  insights: () =>
    jsonResponse({
      data: [
        { name: 'post_media_view', values: [{ value: 5000 }] },
        { name: 'post_total_media_view_unique', values: [{ value: 3200 }] },
        { name: 'post_reactions_by_type_total', values: [{ value: { like: 40, love: 2 } }] },
      ],
    }),
};

describe('FacebookAdapter.fetchMetrics', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('đọc được cảm xúc, bình luận, chia sẻ, impressions và reach', async () => {
    stubGraph(okHandlers);

    const metrics = await facebookAdapter.fetchMetrics('123_456', 'page-token');

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

  it('yêu cầu insights bằng metric views mới, không dùng metric impressions đã bị Meta ngừng', async () => {
    const fetchMock = stubGraph({ ...okHandlers, insights: () => jsonResponse({ data: [] }) });

    await facebookAdapter.fetchMetrics('123_456', 'page-token');

    const insightsUrl = fetchMock.mock.calls
      .map(([input]) => String(input))
      .find((url) => url.includes('/insights'));
    expect(insightsUrl).toContain('post_media_view');
    expect(insightsUrl).toContain('post_total_media_view_unique');
    expect(insightsUrl).not.toContain('post_impressions');
  });

  it('vẫn trả số liệu tương tác khi Facebook từ chối insights', async () => {
    stubGraph({ ...okHandlers, insights: permissionDenied });

    const metrics = await facebookAdapter.fetchMetrics('123_456', 'page-token');

    expect(metrics.reactions).toBe(42);
    expect(metrics.impressions).toBeNull();
    expect(metrics.reach).toBeNull();
    expect(metrics.partialError).toContain('quyền');
  });

  it('vẫn lưu shares khi thiếu quyền đọc reactions và comments', async () => {
    stubGraph({
      ...okHandlers,
      reactions: permissionDenied,
      comments: permissionDenied,
    });

    const metrics = await facebookAdapter.fetchMetrics('123_456', 'page-token');

    expect(metrics.shares).toBe(3);
    expect(metrics.reactions).toBe(0);
    expect(metrics.comments).toBe(0);
    expect(metrics.impressions).toBe(5000);
    expect(metrics.partialError).toContain('quyền');
  });

  it('ném lỗi khi cả ba nhóm field đều bị từ chối', async () => {
    stubGraph({
      ...okHandlers,
      shares: permissionDenied,
      reactions: permissionDenied,
      comments: permissionDenied,
    });

    await expect(facebookAdapter.fetchMetrics('123_456', 'page-token')).rejects.toThrow();
  });

  it('ném lỗi token hết hạn để lớp trên xử lý kênh', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ error: { code: 190, message: 'Invalid token' } }, 401)
      )
    );

    await expect(facebookAdapter.fetchMetrics('123_456', 'page-token')).rejects.toBeInstanceOf(
      SocialTokenExpiredError
    );
  });

  it('mặc định 0 khi Facebook không trả trường tương tác', async () => {
    stubGraph({
      shares: () => jsonResponse({}),
      reactions: () => jsonResponse({}),
      comments: () => jsonResponse({}),
      insights: () => jsonResponse({ data: [] }),
    });

    const metrics = await facebookAdapter.fetchMetrics('123_456', 'page-token');

    expect(metrics.reactions).toBe(0);
    expect(metrics.comments).toBe(0);
    expect(metrics.shares).toBe(0);
    expect(metrics.impressions).toBeNull();
  });
});
