import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import PostEditorForm from '@/components/features/post/PostEditorForm';
import { usePost } from '@/hooks/usePost';
import { canModifyPost } from '@/services/post';
import { useAuthStore } from '@/stores/auth.store';
import { getErrorMessage } from '@/utils/error';
import { SkeletonBlock } from '@/components/ui/Skeleton';
import { useActiveWorkspace } from '@/hooks/useWorkspace';

interface PostEditorLocationState {
  pendingAiGenerationId?: string;
}

export const PostEditorPage = () => {
  const { postId } = useParams<{ postId: string }>();
  const isEdit = Boolean(postId);
  const location = useLocation();
  const navigate = useNavigate();

  const [initialAiGenerationId] = useState<string | null>(() => {
    const state = location.state as PostEditorLocationState | null;
    return state?.pendingAiGenerationId ?? null;
  });

  useEffect(() => {
    if (!initialAiGenerationId) return;
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [initialAiGenerationId, location.pathname, location.search, navigate]);

  const activeWorkspace = useActiveWorkspace();
  const workspaceId = activeWorkspace?.id ?? null;
  const currentUserId = useAuthStore((state) => state.user?.id ?? null);

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
    return <SkeletonBlock className="mx-auto max-w-3xl" />;
  }

  if (isEdit && isError) {
    return <p className="text-sm text-danger">{getErrorMessage(error)}</p>;
  }

  if (
    post &&
    !canModifyPost(post, currentUserId, activeWorkspace?.role ?? 'CONTENT_CREATOR')
  ) {
    return (
      <EmptyState
        className="mx-auto max-w-xl"
        title="Bài viết không thể chỉnh sửa"
        description="Chỉ chỉnh sửa được bài ở trạng thái Nháp hoặc Bị từ chối và do bạn tạo."
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={isEdit ? 'Sửa bài viết' : 'Tạo bài viết'}
        description="Soạn nội dung và lưu dưới dạng bản nháp, sau đó gửi duyệt khi đã sẵn sàng."
      />

      <PostEditorForm
        key={postId ?? 'new'}
        workspaceId={workspaceId}
        post={post ?? null}
        initialAiGenerationId={initialAiGenerationId}
      />
    </div>
  );
};

export default PostEditorPage;
