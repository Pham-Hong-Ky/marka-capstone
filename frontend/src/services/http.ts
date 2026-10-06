import type { AxiosResponse } from 'axios';
import type { ApiResponse } from '@/types';

export const unwrap = <T>(response: AxiosResponse<ApiResponse<T>>): T => {
  const payload = response.data;

  if (!payload || payload.data === undefined || payload.data === null) {
    throw new Error(payload?.message || 'Phản hồi từ máy chủ không hợp lệ');
  }

  return payload.data;
};

export default unwrap;
