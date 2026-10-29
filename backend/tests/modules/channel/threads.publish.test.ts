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

const baseInput = {
  externalAccountId: 'threads-user-1',
  accessToken: 'long-token',
  text: 'Xin chào Threads',
  imageUrls: [] as string[],
};

type FetchCall = {
  url: URL;
  form: URLSearchParams;
  method: string;
};

describe('ThreadsProvider.publish', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('đăng text thuần bằng media_type=TEXT', async () => {
    const calls: FetchCall[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(String(input));
        const form = new URLSearchParams(String(init?.body ?? ''));
        calls.push({ url, form, method: init?.method ?? 'GET' });

        if (url.pathname.endsWith('/threads')) return jsonResponse({ id: 'container-1' });
        if (url.pathname.endsWith('/threads_publish')) return jsonResponse({ id: 'threads-post-1' });
        throw new Error(`Unexpected URL: ${url}`);
      })
    );

    const id = await threadsProvider.publish(baseInput);

    expect(id).toBe('threads-post-1');
    expect(calls[0].form.get('media_type')).toBe('TEXT');
    expect(calls[0].form.get('text')).toBe('Xin chào Threads');
    expect(calls[1].form.get('creation_id')).toBe('container-1');
  });

  it('đăng một ảnh bằng media_type=IMAGE và chờ container FINISHED', async () => {
    const calls: FetchCall[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(String(input));
        const form = new URLSearchParams(String(init?.body ?? ''));
        calls.push({ url, form, method: init?.method ?? 'GET' });

        if (url.pathname.endsWith('/threads')) return jsonResponse({ id: 'container-img' });
        if (url.pathname.includes('/container-img')) return jsonResponse({ status: 'FINISHED' });
        if (url.pathname.endsWith('/threads_publish')) return jsonResponse({ id: 'threads-post-2' });
        throw new Error(`Unexpected URL: ${url}`);
      })
    );

    const id = await threadsProvider.publish({
      ...baseInput,
      imageUrls: ['https://example.com/a.jpg'],
    });

    expect(id).toBe('threads-post-2');
    expect(calls[0].form.get('media_type')).toBe('IMAGE');
    expect(calls[0].form.get('image_url')).toBe('https://example.com/a.jpg');
  });

  it('tạo carousel khi có 2 ảnh', async () => {
    let containerCount = 0;
    const calls: FetchCall[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(String(input));
        const form = new URLSearchParams(String(init?.body ?? ''));
        calls.push({ url, form, method: init?.method ?? 'GET' });

        if (url.pathname.endsWith('/threads_publish')) return jsonResponse({ id: 'threads-post-3' });
        if (url.pathname.endsWith('/threads')) {
          containerCount += 1;
          return jsonResponse({ id: `container-${containerCount}` });
        }
        if (url.pathname.startsWith('/v1.0/container-')) {
          return jsonResponse({ status: 'FINISHED' });
        }
        throw new Error(`Unexpected URL: ${url}`);
      })
    );

    const id = await threadsProvider.publish({
      ...baseInput,
      imageUrls: ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
    });

    expect(id).toBe('threads-post-3');
    const carousel = calls.find((call) => call.form.get('media_type') === 'CAROUSEL');
    expect(carousel?.form.get('children')).toBe('container-1,container-2');
  });

  it('báo lỗi khi text vượt 500 ký tự', async () => {
    await expect(
      threadsProvider.publish({ ...baseInput, text: 'a'.repeat(501) })
    ).rejects.toThrow('500 ký tự');
  });

  it('báo lỗi khi quá 20 ảnh', async () => {
    await expect(
      threadsProvider.publish({
        ...baseInput,
        imageUrls: Array.from({ length: 21 }, (_, index) => `https://example.com/${index}.jpg`),
      })
    ).rejects.toThrow('tối đa 20 ảnh');
  });

  it('báo lỗi khi có hơn 5 liên kết', async () => {
    const text = Array.from({ length: 6 }, (_, index) => `https://example.com/${index}`).join(' ');

    await expect(threadsProvider.publish({ ...baseInput, text })).rejects.toThrow(
      'tối đa 5 liên kết'
    );
  });

  it('gọi onRemoteStart đúng một lần ngay trước khi publish', async () => {
    const order: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = new URL(String(input));
        if (url.pathname.endsWith('/threads')) return jsonResponse({ id: 'container-1' });
        if (url.pathname.endsWith('/threads_publish')) {
          order.push('publish');
          return jsonResponse({ id: 'threads-post-1' });
        }
        throw new Error(`Unexpected URL: ${url}`);
      })
    );

    let called = 0;
    await threadsProvider.publish({
      ...baseInput,
      onRemoteStart: () => {
        called += 1;
        order.push('start');
      },
    });

    expect(called).toBe(1);
    expect(order).toEqual(['start', 'publish']);
  });

  it('map token hết hạn thành SocialTokenExpiredError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ error: { code: 190, message: 'Session has expired' } }, 400)
      )
    );

    await expect(threadsProvider.publish(baseInput)).rejects.toBeInstanceOf(
      SocialTokenExpiredError
    );
  });
});
