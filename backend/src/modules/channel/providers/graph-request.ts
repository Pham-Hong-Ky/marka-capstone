import { getErrorMessage } from '../../../utils/errorMessage.js';
import logger from '../../../utils/logger.js';
import { SocialTransientError } from './social-provider.js';

export interface GraphResult<T> {
  ok: boolean;
  status: number;
  body: T | null;
}

const DEFAULT_TIMEOUT_MS = 10_000;

const readJsonBody = async <T>(response: Response): Promise<T | null> => {
  const raw = await response.text();
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    // Không log URL: query string của nền tảng có thể chứa access_token.
    logger.warn(
      `Phản hồi không phải JSON hợp lệ (HTTP ${response.status}): ${getErrorMessage(error)}`
    );
    throw new SocialTransientError('Không đọc được phản hồi từ nền tảng. Vui lòng thử lại.');
  }
};

/**
 * Gọi HTTP JSON có timeout. Chỉ lo lỗi mạng/timeout/dữ liệu hỏng;
 * lỗi nghiệp vụ do provider tự map theo status + body.
 */
export const requestGraph = async <T>(
  url: URL,
  init?: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<GraphResult<T>> => {
  try {
    const response = await fetch(url, {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(timeoutMs),
    });

    return { ok: response.ok, status: response.status, body: await readJsonBody<T>(response) };
  } catch (error) {
    if (error instanceof SocialTransientError) throw error;

    logger.warn(`Không gọi được API nền tảng: ${getErrorMessage(error)}`);
    throw new SocialTransientError();
  }
};
