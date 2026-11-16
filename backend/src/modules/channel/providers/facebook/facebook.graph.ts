import logger from '../../../../utils/logger.js';
import { BadRequestError } from '../../../../utils/errors/index.js';
import { requestGraph } from '../transport/graph-request.js';
import {
  SocialRateLimitError,
  SocialTokenExpiredError,
  SocialTransientError,
} from '../errors/social.errors.js';

export const GRAPH_BASE = 'https://graph.facebook.com/v21.0';

export interface FacebookApiError {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  fbtrace_id?: string;
}

export interface FacebookErrorBody {
  error?: FacebookApiError;
}

export interface FacebookIdResponse {
  id: string;
}

export interface FacebookTokenResponse {
  access_token: string;
}

export interface FacebookAccountsResponse {
  data: Array<{
    id: string;
    name: string;
    access_token: string;
    picture?: { data?: { url?: string } };
  }>;
  paging?: {
    cursors?: { before?: string; after?: string };
    next?: string;
  };
}

export interface FacebookPostFieldsResponse {
  reactions?: { summary?: { total_count?: number } };
  comments?: { summary?: { total_count?: number } };
  shares?: { count?: number };
}

export interface FacebookInsightsResponse {
  data?: Array<{
    name?: string;
    values?: Array<{ value?: number | Record<string, number> }>;
  }>;
}

/** Map mã lỗi Graph API sang lỗi chung của provider. */
const throwGraphError = (status: number, error: FacebookApiError | undefined): never => {
  const message = error?.message ?? '';

  // Chỉ log mã lỗi do ta kiểm soát. Message thô từ Graph có thể kèm giá trị
  // tham số của request (kể cả access_token) nên không được ghi log.
  logger.warn(
    `Facebook Graph API lỗi [status: ${status}, code: ${error?.code ?? 'N/A'}, subcode: ${error?.error_subcode ?? 'N/A'}, type: ${error?.type ?? 'N/A'}]`
  );

  if (error?.code === 190) {
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

  if (
    error?.code === 100 &&
    (message.includes('code') || message.includes('expired') || message.includes('consumed'))
  ) {
    throw new BadRequestError('Mã xác thực Facebook không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.');
  }

  if (error?.code === 10 || error?.code === 200 || error?.code === 102) {
    throw new BadRequestError('Tài khoản Facebook không đủ quyền hoặc đã từ chối cấp quyền.');
  }

  if (status >= 500) {
    throw new SocialTransientError('Facebook đang gặp sự cố. Hệ thống sẽ thử lại sau.');
  }

  // Không trả nguyên văn message của nền tảng cho người dùng: thường là tiếng Anh.
  throw new BadRequestError('Facebook từ chối yêu cầu. Vui lòng thử lại.');
};

const request = async <T>(
  method: 'GET' | 'POST',
  path: string,
  params: Record<string, string>,
  form?: Record<string, string>,
  timeoutMs?: number
): Promise<T> => {
  const url = new URL(`${GRAPH_BASE}${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  const init: RequestInit = { method };
  if (form) {
    init.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    init.body = new URLSearchParams(form).toString();
  }

  const { ok, status, body } = await requestGraph<T & FacebookErrorBody>(url, init, timeoutMs);

  if (!ok || body?.error) {
    throwGraphError(status, body?.error);
  }

  return (body ?? {}) as T;
};

export const facebookGet = <T>(path: string, params: Record<string, string>): Promise<T> =>
  request<T>('GET', path, params);

export const facebookPost = <T>(
  path: string,
  form: Record<string, string>,
  timeoutMs?: number
): Promise<T> => request<T>('POST', path, {}, form, timeoutMs);
