import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import EmptyState from '@/components/ui/EmptyState';
import PageContainer from '@/components/ui/PageContainer';
import PageHeader from '@/components/ui/PageHeader';
import PostEditorForm from '@/components/features/post/PostEditorForm';
import { usePost } from '@/hooks/usePost';
import { canEditPost } from '@/services/post';
import { useAuthStore } from '@/stores/auth.store';
import { getErrorMessage } from '@/utils/error';
import { SkeletonBlock } from '@/components/ui/Skeleton';
import { useActiveWorkspace } from '@/hooks/useWorkspace';

interface PostEditorLocationState {
  pendingAiGenerationIds?: string[];
}

interface PendingAiGeneration {
  postId: string;
  generationIds: string[];
}

export const PostEditorPage = () => {
  const { postId } = useParams<{ postId: string }>();
  const isEdit = Boolean(postId);
  const location = useLocation();
  const navigate = useNavigate();

  // Từ /posts/new sang /posts/:id/edit React Router không remount page. Giữ ID
  // trong state để không mất khi trang tạm hiện skeleton chờ tải bài.
  const postKey = postId ?? 'new';
  const pendingAiGenerationIds =
    (location.state as PostEditorLocationState | null)?.pendingAiGenerationIds ?? null;
  const [pendingAi, setPendingAi] = useState<PendingAiGeneration | null>(
    pendingAiGenerationIds ? { postId: postKey, generationIds: pendingAiGenerationIds } : null
  );
  const initialAiGenerationIds =
    pendingAi?.postId === postKey ? pendingAi.generationIds : [];

  useEffect(() => {
    if (!pendingAiGenerationIds) return;
    setPendingAi({ postId: postKey, generationIds: pendingAiGenerationIds });
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [pendingAiGenerationIds, postKey, location.pathname, location.search, navigate]);

  useEffect(() => {
    if (pendingAi && pendingAi.postId !== postKey) setPendingAi(null);
  }, [pendingAi, postKey]);

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
    !canEditPost(post, currentUserId, activeWorkspace?.role ?? 'CONTENT_CREATOR')
  ) {
    return (
      <EmptyState
        className="mx-auto max-w-xl"
        title="Bài viết không thể chỉnh sửa"
        description="Chỉ chỉnh sửa được bài Nháp, hoặc bài Bị từ chối do bạn tạo."
      />
    );
  }

  return (
    <PageContainer width="wide">
      <PageHeader
        title={isEdit ? 'Sửa bài viết' : 'Tạo bài viết'}
        description="Soạn nội dung và lưu dưới dạng bản nháp, sau đó gửi duyệt khi đã sẵn sàng."
      />

      <PostEditorForm
        key={postId ?? 'new'}
        workspaceId={workspaceId}
        post={post ?? null}
        initialAiGenerationIds={initialAiGenerationIds}
      />
    </PageContainer>
  );
};

export default PostEditorPage;
