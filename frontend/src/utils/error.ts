import { AxiosError } from 'axios';

export const getErrorStatus = (error: unknown): number | undefined => {
  if (error instanceof AxiosError) {
    return error.response?.status;
  }
  return undefined;
};

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof AxiosError) {
    const payload = error.response?.data as { message?: string } | undefined;
    if (payload?.message) return payload.message;
  }

  if (error instanceof Error && error.message) return error.message;

  return 'Đã có lỗi xảy ra. Vui lòng thử lại.';
};
