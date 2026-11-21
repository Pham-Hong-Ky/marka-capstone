import { usePostVersions } from '@/hooks/usePost';
import { formatDateTime } from '@/utils/format';
import { getErrorMessage } from '@/utils/error';

export const PostEditHistory = ({
  workspaceId,
  postId,
}: {
  workspaceId: string;
  postId: string;
}) => {
  const { data, isLoading, isError, error } = usePostVersions(workspaceId, postId);
  const versions = data ?? [];

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium text-foreground">Lịch sử sửa</h3>

      {isLoading ? (
        <p role="status" className="text-xs text-muted">
          Đang tải lịch sử...
        </p>
      ) : isError ? (
        <p role="alert" className="text-sm text-danger">
          {getErrorMessage(error)}
        </p>
      ) : versions.length === 0 ? (
        <p className="text-xs text-subtle">Chưa có lần sửa nào.</p>
      ) : (
        <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-xl border border-border">
          {versions.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-foreground" title={item.title}>
                  v{item.version} · {item.title}
                </p>
                <p className="truncate text-[11px] text-muted">
                  {item.source === 'RESTORE' ? 'Khôi phục · ' : ''}
                  {item.createdBy?.name ?? 'Không xác định'}
                </p>
              </div>
              <span className="shrink-0 text-[11px] text-muted">
                {formatDateTime(item.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default PostEditHistory;
