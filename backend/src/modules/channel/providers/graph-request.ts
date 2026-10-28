import logger from '../../../utils/logger.js';
import { SocialTransientError } from './social-provider.js';

export interface GraphResult<T> {
  ok: boolean;
  status: number;
  body: T | null;
}

const DEFAULT_TIMEOUT_MS = 10_000;

/** Tên loại lỗi (vd `TypeError`, `TimeoutError`) — an toàn để log, không kèm message. */
const errorName = (error: unknown): string =>
  error instanceof Error ? error.name : 'UnknownError';

const readJsonBody = async <T>(response: Response): Promise<T | null> => {
  const raw = await response.text();
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    // Không log URL lẫn message lỗi: cả hai có thể lộ access_token trong query.
    logger.warn(`Phản hồi không phải JSON hợp lệ (HTTP ${response.status})`);
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

    // Chỉ log loại lỗi: message gốc (vd "fetch failed" của undici) có thể kèm
    // URL request, mà URL GET của nền tảng chứa access_token.
    logger.warn(`Không gọi được API nền tảng: ${errorName(error)}`);
    throw new SocialTransientError();
  }
};
