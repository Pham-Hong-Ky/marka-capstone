import { useParams } from 'react-router-dom';
import EmptyState from '@/components/ui/EmptyState';
import PostEditorForm from '@/components/features/post/PostEditorForm';
import { usePost } from '@/hooks/usePost';
import { useAuthStore } from '@/stores/auth.store';
import { getErrorMessage } from '@/utils/error';

export const PostEditorPage = () => {
  const { postId } = useParams<{ postId: string }>();
  const isEdit = Boolean(postId);

  const user = useAuthStore((state) => state.user);
  const activeWorkspaceId = useAuthStore((state) => state.activeWorkspaceId);
  const activeWorkspace =
    (user?.workspaces ?? []).find((workspace) => workspace.id === activeWorkspaceId) ??
    user?.workspaces[0];
  const workspaceId = activeWorkspace?.id ?? null;

  const { data: post, isLoading, isError, error } = usePost(
    workspaceId,
    isEdit ? postId ?? null : null
  );

  if (!workspaceId) {
    return (
      <EmptyState
        title="Bạn chưa có workspace nào."
        description="Tạo workspace để bắt đầu soạn nội dung."
      />
    );
  }

  if (isEdit && isLoading) {
    return <p className="text-sm text-muted">Đang tải bài viết...</p>;
  }

  if (isEdit && isError) {
    return <p className="text-sm text-red-600 dark:text-red-400">{getErrorMessage(error)}</p>;
  }

  if (post && post.status !== 'DRAFT' && post.status !== 'REJECTED') {
    return (
      <EmptyState
        className="mx-auto max-w-xl"
        title="Bài viết không thể chỉnh sửa"
        description="Chỉ chỉnh sửa được bài ở trạng thái Nháp hoặc Bị từ chối."
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {isEdit ? 'Sửa bài viết' : 'Tạo bài viết'}
        </h1>
        <p className="text-sm text-muted">
          Soạn nội dung và lưu dưới dạng bản nháp, sau đó gửi duyệt khi đã sẵn sàng.
        </p>
      </div>

      <PostEditorForm key={postId ?? 'new'} workspaceId={workspaceId} post={post ?? null} />
    </div>
  );
};

export default PostEditorPage;
