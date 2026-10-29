import { useEffect } from 'react';

/** Kéo trang hiện tại về trang cuối khi dữ liệu co lại (vd lọc bớt, xoá bản ghi). */
export const useClampPage = (
  page: number,
  totalPages: number | undefined,
  setPage: (page: number) => void
) => {
  useEffect(() => {
    if (totalPages !== undefined && page > totalPages) {
      setPage(Math.max(1, totalPages));
    }
  }, [page, totalPages, setPage]);
};

export default useClampPage;
