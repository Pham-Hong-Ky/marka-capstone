import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import PostStatusBadge from './PostStatusBadge';
import type { PaginationMeta, PostSummary } from '@/services/post';
import { formatDate } from '@/utils/format';

export const PostList = ({
  posts,
  meta,
  onOpen,
  onPageChange,
}: {
  posts: PostSummary[];
  meta: PaginationMeta;
  onOpen: (post: PostSummary) => void;
  onPageChange: (page: number) => void;
}) => {
  if (posts.length === 0) {
    return (
      <EmptyState
        title="Chưa có bài viết nào."
        description="Bấm “Tạo bài viết” để bắt đầu soạn nội dung."
      />
    );
  }

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-2 text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Tiêu đề</th>
              <th className="px-4 py-3 font-medium">Trạng thái</th>
              <th className="px-4 py-3 font-medium">Cập nhật</th>
              <th className="px-4 py-3 text-right font-medium">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {posts.map((post) => (
              <tr key={post.id}>
                <td className="max-w-xs truncate px-4 py-3 font-medium text-foreground">
                  {post.title}
                </td>
                <td className="px-4 py-3">
                  <PostStatusBadge status={post.status} />
                </td>
                <td className="px-4 py-3 text-muted">{formatDate(post.updatedAt)}</td>
                <td className="px-4 py-3 text-right">
                  <Button
                    type="button"
                    variant="outline"
                    className="px-3"
                    onClick={() => onOpen(post)}
                  >
                    Xem
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {meta.totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-muted">
          <span>
            Trang {meta.page}/{meta.totalPages} · {meta.total} bài viết
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={meta.page <= 1}
              onClick={() => onPageChange(meta.page - 1)}
            >
              Trước
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={meta.page >= meta.totalPages}
              onClick={() => onPageChange(meta.page + 1)}
            >
              Sau
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default PostList;
