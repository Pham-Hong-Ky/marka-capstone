import Avatar from '@/components/ui/Avatar';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import PostRowActions from './PostRowActions';
import PostStatusBadge from './PostStatusBadge';
import type { WorkspaceRole } from '@/services/auth';
import { canModifyPost, type PaginationMeta, type PostSummary } from '@/services/post';
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

  return (
    <div className="space-y-4">
      <Table className="min-w-[640px]">
        <THead>
          <TR>
            <TH scope="col">Tiêu đề</TH>
            <TH scope="col" className="hidden md:table-cell">
              Người tạo
            </TH>
            <TH scope="col">Trạng thái</TH>
            <TH scope="col" className="hidden sm:table-cell">
              Cập nhật
            </TH>
            <TH scope="col" className="text-right">
              Hành động
            </TH>
          </TR>
        </THead>
        <TBody>
          {posts.map((post) => (
            <TR key={post.id}>
              <TD className="max-w-xs truncate font-medium text-foreground" title={post.title}>
                {post.title}
              </TD>
              <TD className="hidden md:table-cell">
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
              </TD>
              <TD className="whitespace-nowrap">
                <PostStatusBadge status={post.status} />
              </TD>
              <TD className="hidden whitespace-nowrap text-muted sm:table-cell">
                {formatDate(post.updatedAt)}
              </TD>
              <TD className="px-2 py-2 text-right">
                <PostRowActions
                  post={post}
                  canEdit={canModifyPost(post, currentUserId, role)}
                  onView={() => onOpen(post)}
                  onEdit={() => onEdit(post)}
                  onDelete={() => onDelete(post)}
                />
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

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
