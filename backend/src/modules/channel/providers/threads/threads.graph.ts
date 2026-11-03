import logger from '../../../../utils/logger.js';
import { BadRequestError } from '../../../../utils/errors/index.js';
import { requestGraph } from '../transport/graph-request.js';
import {
  SocialRateLimitError,
  SocialTokenExpiredError,
  SocialTransientError,
} from '../errors/social.errors.js';

export const GRAPH_BASE = 'https://graph.threads.com/v1.0';
export const AUTHORIZE_URL = 'https://threads.com/oauth/authorize';
export const TOKEN_URL = 'https://graph.threads.com/oauth/access_token';
export const LONG_TOKEN_URL = 'https://graph.threads.com/access_token';
export const REFRESH_URL = 'https://graph.threads.com/refresh_access_token';

export interface ThreadsApiError {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
}

export interface ThreadsErrorBody {
  error?: ThreadsApiError;
  error_type?: string;
  error_message?: string;
}

export interface ThreadsTokenResponse {
  access_token: string;
}

export interface ThreadsProfileResponse {
  id: string;
  username?: string;
  name?: string;
  threads_profile_picture_url?: string;
}

export interface ThreadsInsightsResponse {
  data?: Array<{
    name?: string;
    values?: Array<{ value?: number | Record<string, number> }>;
  }>;
}

export const threadsApiUrl = (path: string, params: Record<string, string> = {}): URL => {
  const url = new URL(`${GRAPH_BASE}${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url;
};

const throwThreadsError = (status: number, body: ThreadsErrorBody | null): never => {
  const error = body?.error;
  const message = error?.message ?? body?.error_message ?? '';

  logger.warn(
    `Threads API lỗi [status: ${status}, code: ${error?.code ?? 'N/A'}, type: ${
      error?.type ?? body?.error_type ?? 'N/A'
    }]`
  );

  if (
    error?.code === 190 ||
    /expired|invalid.*token|session.*invalid/i.test(message)
  ) {
    throw new SocialTokenExpiredError();
  }

  if (
    error?.code === 4 ||
    error?.code === 17 ||
    error?.code === 32 ||
    error?.code === 613 ||
    status === 429
  ) {
    throw new SocialRateLimitError();
  }

  if (/24 hours|too new/i.test(message)) {
    throw new SocialTransientError('Token Threads chưa đủ 24 giờ để gia hạn.');
  }

  if (status >= 500) {
    throw new SocialTransientError('Threads đang gặp sự cố. Hệ thống sẽ thử lại sau.');
  }

  throw new BadRequestError('Threads từ chối yêu cầu. Vui lòng thử lại.');
};

/** Gọi Threads API và ném lỗi nghiệp vụ nếu phản hồi không ok. */
export const threadsRequest = async <T>(
  url: URL,
  init?: RequestInit
): Promise<T> => {
  const result = await requestGraph<T & ThreadsErrorBody>(url, init);

  if (!result.ok || result.body?.error) {
    throwThreadsError(result.status, result.body);
  }

  return (result.body ?? {}) as T;
};
