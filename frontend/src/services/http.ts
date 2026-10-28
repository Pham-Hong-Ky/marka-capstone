import type { AxiosResponse } from 'axios';
import type { ApiResponse, PaginationMeta } from '@/types';

export const unwrap = <T>(response: AxiosResponse<ApiResponse<T>>): T => {
  const payload = response.data;

  if (!payload || payload.data === undefined || payload.data === null) {
    throw new Error(payload?.message || 'Phản hồi từ máy chủ không hợp lệ');
  }

  return payload.data;
};

export const unwrapPaginated = <T>(
  response: AxiosResponse<ApiResponse<T, PaginationMeta>>
): { data: T; meta: PaginationMeta } => {
  const payload = response.data;

  if (!payload || payload.data === undefined || payload.data === null || !payload.meta) {
    throw new Error(payload?.message || 'Phản hồi phân trang từ máy chủ không hợp lệ');
  }

  return { data: payload.data, meta: payload.meta };
};

export default unwrap;
