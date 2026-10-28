import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import env from '../config/env';
import { authStorage } from '@/lib/storage';

// Chỉ một lượt refresh chạy tại một thời điểm; các request 401 khác xếp hàng chờ.
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: AxiosError | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve();
    }
  });
  failedQueue = [];
};

export const httpClient = axios.create({
  baseURL: env.VITE_API_URL,
  withCredentials: true,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

httpClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const accessToken = authStorage.getAccessToken();
    if (accessToken && config.headers && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    const workspaceId = authStorage.getActiveWorkspaceId();
    if (workspaceId && config.headers && !config.headers['x-workspace-id']) {
      config.headers['x-workspace-id'] = workspaceId;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

httpClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (!error.response) {
      return Promise.reject(
        new Error('Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại đường truyền mạng.')
      );
    }

    const { status } = error.response;

    // 401 từ các endpoint xác thực là sai thông tin đăng nhập, refresh không giúp được gì.
    const isAuthUrl =
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/register') ||
      originalRequest.url?.includes('/auth/google') ||
      originalRequest.url?.includes('/auth/refresh');

    // Đổi mật khẩu/xoá tài khoản trả 401 khi sai mật khẩu, không phải token hết hạn:
    // thử refresh ở đây sẽ đăng xuất người dùng và che mất thông báo lỗi của server.
    const isBusinessAuthUrl =
      Boolean(originalRequest.url?.includes('/users/me/password')) ||
      (originalRequest.method?.toLowerCase() === 'delete' &&
        Boolean(originalRequest.url?.endsWith('/users/me')));

    if (status === 401 && !originalRequest._retry && !isAuthUrl && !isBusinessAuthUrl) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            // Request xếp hàng vẫn mang token cũ; interceptor request không ghi đè header có sẵn.
            originalRequest._retry = true;
            originalRequest.headers.Authorization = `Bearer ${authStorage.getAccessToken()}`;
            return httpClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshResponse = await axios.post(
          `${env.VITE_API_URL}/auth/refresh-token`,
          {},
          { withCredentials: true, timeout: 10_000 }
        );

        const newAccessToken =
          refreshResponse.data?.data?.accessToken ||
          refreshResponse.data?.accessToken;

        if (newAccessToken) {
          authStorage.setAccessToken(newAccessToken);
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          }
        }

        processQueue(null);
        return httpClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as AxiosError);
        authStorage.clearAccessToken();

        // Phát sự kiện để auth store tự đăng xuất, giữ httpClient không phụ thuộc vào store.
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default httpClient;
