import { afterEach, describe, expect, it, vi } from 'vitest';
import logger from '../../../src/utils/logger.js';
import { facebookProvider } from '../../../src/modules/channel/providers/facebook.provider.js';
import {
  SocialRateLimitError,
  SocialTransientError,
} from '../../../src/modules/channel/providers/social-provider.js';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/** Mỗi lần gọi phải là Response mới vì body chỉ đọc được một lần. */
const stubGraphError = (error: unknown, status: number) =>
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => jsonResponse({ error }, status)));

const capturedError = async (): Promise<Error> => {
  try {
    await facebookProvider.fetchProfile('page-token');
  } catch (error) {
    return error as Error;
  }
  throw new Error('Kỳ vọng fetchProfile ném lỗi');
};

describe('FacebookProvider — lỗi trả người dùng và log', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('lỗi Graph không xác định → message tiếng Việt, không lộ nguyên văn của nền tảng', async () => {
    const warn = vi.spyOn(logger, 'warn');
    stubGraphError(
      { code: 999, type: 'GraphMethodException', message: 'Duplicate story detected in feed' },
      400
    );

    const error = await capturedError();

    expect(error.message).toBe('Facebook từ chối yêu cầu. Vui lòng thử lại.');
    expect(warn).toHaveBeenCalled();
    expect(warn.mock.calls.flat().join(' ')).not.toContain('Duplicate story');
  });

  it('giữ message tiếng Việt riêng cho lỗi giới hạn tần suất', async () => {
    stubGraphError({ code: 4, message: 'Application request limit reached' }, 400);

    await expect(facebookProvider.fetchProfile('page-token')).rejects.toBeInstanceOf(
      SocialRateLimitError
    );
    await expect(facebookProvider.fetchProfile('page-token')).rejects.toThrow(
      'Nền tảng đang giới hạn tần suất. Hệ thống sẽ thử lại sau.'
    );
  });

  it('log lỗi mạng không kèm URL hay access_token', async () => {
    const warn = vi.spyOn(logger, 'warn');
    const secret = 'EAASECRETOKEN';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(
        new TypeError(`fetch failed https://graph.facebook.com/v21.0/me?access_token=${secret}`)
      )
    );

    await expect(facebookProvider.fetchProfile(secret)).rejects.toBeInstanceOf(
      SocialTransientError
    );

    const logged = warn.mock.calls.flat().join(' ');
    expect(warn).toHaveBeenCalled();
    expect(logged).not.toContain(secret);
    expect(logged).not.toContain('access_token');
    expect(logged).not.toContain('graph.facebook.com');
  });
});
