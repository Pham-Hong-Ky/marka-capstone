import type { PaginationMeta } from '@/types';

export const emptyPaginationMeta = (limit = 10): PaginationMeta => ({
  page: 1,
  limit,
  total: 0,
  totalPages: 0,
});

export default emptyPaginationMeta;
