import Avatar from '@/components/ui/Avatar';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import PostRowActions from './PostRowActions';
import PostStatusBadge from './PostStatusBadge';
import type { WorkspaceRole } from '@/services/auth';
import type { PaginationMeta, PostSummary } from '@/services/post';
import { formatDate } from '@/utils/format';

export const PostList = ({
  posts,
  meta,
  role,
  currentUserId,
  onOpen,
  onEdit,
  onDelete,
  onPageChange,
}: {
  posts: PostSummary[];
  meta: PaginationMeta;
  role: WorkspaceRole;
  currentUserId: string | null;
  onOpen: (post: PostSummary) => void;
  onEdit: (post: PostSummary) => void;
  onDelete: (post: PostSummary) => void;
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

  const canModify = (post: PostSummary) =>
    (role === 'OWNER' || post.createdById === currentUserId) &&
    (post.status === 'DRAFT' || post.status === 'REJECTED');

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-surface-2 text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Tiêu đề</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Người tạo</th>
                <th className="px-4 py-3 font-medium">Trạng thái</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Cập nhật</th>
                <th className="px-4 py-3 text-right font-medium">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {posts.map((post) => (
                <tr key={post.id}>
                  <td
                    className="max-w-xs truncate px-4 py-3 font-medium text-foreground"
                    title={post.title}
                  >
                    {post.title}
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <div className="flex items-center gap-2">
                      <Avatar
                        name={post.createdBy?.name}
                        src={post.createdBy?.avatar}
                        className="h-7 w-7"
                      />
                      <span className="max-w-40 truncate text-foreground">
                        {post.createdBy?.name ?? 'Không xác định'}
                      </span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <PostStatusBadge status={post.status} />
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-muted sm:table-cell">
                    {formatDate(post.updatedAt)}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <PostRowActions
                      post={post}
                      canEdit={canModify(post)}
                      onView={() => onOpen(post)}
                      onEdit={() => onEdit(post)}
                      onDelete={() => onDelete(post)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Pagination
        page={meta.page}
        limit={meta.limit}
        total={meta.total}
        totalPages={meta.totalPages}
        onPageChange={onPageChange}
        itemLabel="bài viết"
      />
    </div>
  );
};

export default PostList;
