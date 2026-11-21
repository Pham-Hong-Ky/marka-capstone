import { afterEach, describe, expect, it, vi } from 'vitest';
import { threadsAdapter } from '../../../src/modules/channel/providers/threads/threads.adapter.js';
import { SocialPostGoneError } from '../../../src/modules/channel/providers/errors/social.errors.js';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('ThreadsAdapter.deletePost', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('gọi DELETE tới id bài với access_token', async () => {
    const fetchMock = vi.fn().mockImplementation(() => jsonResponse({ success: true }));
    vi.stubGlobal('fetch', fetchMock);

    await threadsAdapter.deletePost('thread-1', 'long-token');

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(init.method).toBe('DELETE');
    expect(url.pathname).toMatch(/\/thread-1$/);
    expect(url.searchParams.get('access_token')).toBe('long-token');
  });

  it('bài không còn tồn tại (404) → SocialPostGoneError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => jsonResponse({ error: { message: 'not found' } }, 404))
    );

    await expect(threadsAdapter.deletePost('thread-1', 'long-token')).rejects.toBeInstanceOf(
      SocialPostGoneError
    );
  });

  it('thiếu quyền (code 10) → báo kết nối lại kênh', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => jsonResponse({ error: { code: 10, message: 'no perm' } }, 403))
    );

    await expect(threadsAdapter.deletePost('thread-1', 'long-token')).rejects.toThrow(
      'Vui lòng kết nối lại kênh'
    );
  });
});
