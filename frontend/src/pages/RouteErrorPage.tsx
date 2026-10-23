import { useEffect } from 'react';
import { useRouteError } from 'react-router-dom';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';

const RELOAD_KEY = 'chunk_reload_at';
const RELOAD_GUARD_MS = 10_000;

const isChunkLoadError = (error: unknown): boolean =>
  error instanceof Error &&
  /dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
    error.message
  );

// Sau mỗi lần deploy, tab đang mở vẫn trỏ tới chunk cũ đã bị xoá → tải lại để lấy bản mới.
const shouldAutoReload = (): boolean => {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < RELOAD_GUARD_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    return true;
  } catch (error) {
    console.warn('Không đọc được sessionStorage', error);
    return false;
  }
};

export const RouteErrorPage = () => {
  const error = useRouteError();
  const chunkError = isChunkLoadError(error);

  useEffect(() => {
    if (chunkError && shouldAutoReload()) {
      window.location.reload();
    }
  }, [chunkError]);

  return (
    <div className="grid min-h-screen place-items-center bg-background p-4">
      <EmptyState
        className="w-full max-w-md bg-surface"
        title={chunkError ? 'Ứng dụng vừa được cập nhật' : 'Đã xảy ra lỗi không mong muốn'}
        description={
          chunkError
            ? 'Vui lòng tải lại trang để dùng phiên bản mới nhất.'
            : 'Vui lòng tải lại trang. Nếu lỗi vẫn tiếp diễn, hãy thử lại sau ít phút.'
        }
        action={
          <Button type="button" onClick={() => window.location.reload()}>
            Tải lại trang
          </Button>
        }
      />
    </div>
  );
};

export default RouteErrorPage;
