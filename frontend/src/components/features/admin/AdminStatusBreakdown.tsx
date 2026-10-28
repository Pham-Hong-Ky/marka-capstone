import PostStatusBadge from '@/components/features/post/PostStatusBadge';
import { POST_STATUS_LABELS, type PostStatus } from '@/services/post';
import { formatNumber } from '@/utils/format';

const STATUS_ENTRIES = Object.keys(POST_STATUS_LABELS) as PostStatus[];

export const AdminStatusBreakdown = ({ byStatus }: { byStatus?: Record<string, number> }) => {
  const counts = byStatus ?? {};
  const hasPosts = Object.keys(counts).length > 0;

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="text-base font-semibold text-foreground">Bài viết theo trạng thái</h2>

      {hasPosts ? (
        <ul className="mt-4 space-y-3">
          {STATUS_ENTRIES.map((status) => (
            <li key={status} className="flex items-center justify-between gap-3">
              <PostStatusBadge status={status} />
              <span className="text-sm font-medium tabular-nums text-foreground">
                {formatNumber(counts[status] ?? 0)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted">Chưa có bài viết.</p>
      )}
    </section>
  );
};

export default AdminStatusBreakdown;
