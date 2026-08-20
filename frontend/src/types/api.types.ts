export interface ApiResponse<T = unknown> {
  status: 'success' | 'fail' | 'error';
  message: string;
  data?: T;
  meta?: {
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    [key: string]: unknown;
  };
}
