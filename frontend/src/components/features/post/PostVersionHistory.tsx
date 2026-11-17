import { useState } from 'react';
import { History } from 'lucide-react';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { usePostVersions, useRestorePostVersion } from '@/hooks/usePost';
import type { PostDetail, PostVersionSummary } from '@/services/post';
import { formatDateTime } from '@/utils/format';
import { getErrorMessage } from '@/utils/error';

export const PostVersionHistory = ({
  workspaceId,
  postId,
  disabled = false,
  onRestored,
}: {
  workspaceId: string;
  postId: string;
  disabled?: boolean;
  onRestored: (post: PostDetail) => void;
}) => {
  const versionsQuery = usePostVersions(workspaceId, postId);
  const restore = useRestorePostVersion();
  const [target, setTarget] = useState<PostVersionSummary | null>(null);

  const versions = versionsQuery.data ?? [];

  const confirmRestore = () => {
    if (!target) return;
    restore.mutate(
      { workspaceId, postId, version: target.version },
      {
        onSuccess: (post) => onRestored(post),
        onSettled: () => setTarget(null),
      }
    );
  };

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 shrink-0 text-accent-text" aria-hidden="true" />
        <h3 className="text-sm font-medium text-foreground">Lịch sử phiên bản</h3>
      </div>
      <p className="mt-1 text-[11px] text-subtle">
        Mỗi lần lưu bài tạo một phiên bản, giữ tối đa 30 bản gần nhất.
      </p>

      {versionsQuery.isLoading ? (
        <p role="status" className="mt-3 text-xs text-muted">
          Đang tải lịch sử...
        </p>
      ) : versionsQuery.isError ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {getErrorMessage(versionsQuery.error)}
        </p>
      ) : versions.length === 0 ? (
        <p className="mt-3 text-xs text-subtle">Chưa có phiên bản nào.</p>
      ) : (
        <ul className="mt-3 max-h-72 divide-y divide-border overflow-y-auto">
          {versions.map((item, index) => (
            <li key={item.id} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-foreground" title={item.title}>
                  v{item.version} · {item.title}
                </p>
                <p className="truncate text-[11px] text-muted">
                  {item.source === 'RESTORE' ? 'Khôi phục · ' : ''}
                  {item.createdBy?.name ?? 'Không xác định'} · {formatDateTime(item.createdAt)}
                </p>
              </div>
              {index === 0 ? (
                <span className="shrink-0 text-[11px] font-semibold text-accent-text">Mới nhất</span>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0"
                  disabled={disabled}
                  aria-label={`Khôi phục phiên bản ${item.version}`}
                  onClick={() => setTarget(item)}
                >
                  Khôi phục
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={target !== null}
        onClose={() => setTarget(null)}
        title="Khôi phục phiên bản"
        confirmLabel="Khôi phục"
        isLoading={restore.isPending}
        onConfirm={confirmRestore}
        description={
          <>
            Tiêu đề và nội dung bài sẽ được thay bằng phiên bản {target?.version}. Phần đang soạn
            chưa lưu sẽ bị thay thế; các phiên bản hiện có vẫn được giữ.
          </>
        }
      />
    </section>
  );
};

export default PostVersionHistory;
