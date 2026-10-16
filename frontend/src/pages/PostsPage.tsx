import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PostToolbar from '@/components/features/post/PostToolbar';
import PostList from '@/components/features/post/PostList';
import PostDetailModal from '@/components/features/post/PostDetailModal';
import RejectPostModal from '@/components/features/post/RejectPostModal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import { useDeletePost, usePosts } from '@/hooks/usePost';
import { useAuthStore } from '@/stores/auth.store';
import { getErrorMessage } from '@/utils/error';
import type { PostDetail, PostStatus } from '@/services/post';

export const PostsPage = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const activeWorkspaceId = useAuthStore((state) => state.activeWorkspaceId);
  const activeWorkspace =
    (user?.workspaces ?? []).find((workspace) => workspace.id === activeWorkspaceId) ??
    user?.workspaces[0];
  const workspaceId = activeWorkspace?.id ?? null;
  const role = activeWorkspace?.role ?? 'CONTENT_CREATOR';

  const [status, setStatus] = useState<PostStatus | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [rejectingPostId, setRejectingPostId] = useState<string | null>(null);
  const [postToDelete, setPostToDelete] = useState<PostDetail | null>(null);

  const { data, isLoading, isError, error } = usePosts(workspaceId, {
    page,
    limit: 10,
    status: status ?? undefined,
    search: search || undefined,
  });
  const deletePost = useDeletePost();

  if (!workspaceId) {
    return (
      <EmptyState
        title="Bạn chưa có workspace nào."
        description="Tạo workspace để bắt đầu soạn nội dung."
      />
    );
  }

  const changeStatus = (next: PostStatus | null) => {
    setStatus(next);
    setPage(1);
  };

  const runSearch = (term: string) => {
    setSearch(term);
    setPage(1);
  };

  const openCreate = () => {
    navigate('/posts/new');
  };

  const confirmDelete = () => {
    if (!postToDelete) return;
    deletePost.mutate(
      { workspaceId, postId: postToDelete.id },
      {
        onSettled: () => {
          setPostToDelete(null);
          setSelectedPostId(null);
        },
      }
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Nội dung</h1>
        <p className="text-sm text-muted">
          Soạn thảo, gửi duyệt và quản lý bài viết trong workspace.
        </p>
      </div>

      <PostToolbar
        status={status}
        onStatusChange={changeStatus}
        onSearch={runSearch}
        onCreate={openCreate}
      />

      {isLoading ? <p className="text-sm text-muted">Đang tải danh sách bài viết...</p> : null}

      {isError ? (
        <p className="text-sm text-red-600 dark:text-red-400">{getErrorMessage(error)}</p>
      ) : null}

      {data ? (
        <PostList
          posts={data.posts}
          meta={data.meta}
          onOpen={(post) => setSelectedPostId(post.id)}
          onPageChange={setPage}
        />
      ) : null}

      {selectedPostId ? (
        <PostDetailModal
          open
          onClose={() => setSelectedPostId(null)}
          workspaceId={workspaceId}
          postId={selectedPostId}
          role={role}
          onEdit={(post) => navigate(`/posts/${post.id}/edit`)}
          onReject={(id) => {
            setSelectedPostId(null);
            setRejectingPostId(id);
          }}
          onDelete={(post) => setPostToDelete(post)}
        />
      ) : null}

      <RejectPostModal
        open={rejectingPostId !== null}
        onClose={() => setRejectingPostId(null)}
        workspaceId={workspaceId}
        postId={rejectingPostId ?? ''}
      />

      <ConfirmDialog
        open={postToDelete !== null}
        onClose={() => setPostToDelete(null)}
        tone="danger"
        title="Xóa bài viết"
        confirmLabel="Xóa"
        isLoading={deletePost.isPending}
        onConfirm={confirmDelete}
        description={
          <>
            Xóa bài viết{' '}
            <span className="font-medium text-foreground">{postToDelete?.title}</span>? Hành động
            này không thể hoàn tác.
          </>
        }
      />
    </div>
  );
};

export default PostsPage;
