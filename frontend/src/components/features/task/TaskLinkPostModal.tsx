import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { useLinkTaskPost } from '@/hooks/useTasks';
import { usePosts } from '@/hooks/usePost';
import PostStatusBadge from '@/components/features/post/PostStatusBadge';
import { useAuthStore } from '@/stores/auth.store';
import type { TaskItem } from '@/services/task';
import { cn } from '@/utils/cn';
import { formatDate } from '@/utils/format';

export const TaskLinkPostModal = ({
  open,
  onClose,
  workspaceId,
  task,
  canManage,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  task: TaskItem;
  canManage: boolean;
}) => {
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const linkPost = useLinkTaskPost();
  const currentUserId = useAuthStore((state) => state.user?.id ?? null);

  const { data, isLoading } = usePosts(
    open ? workspaceId : null,
    { limit: 50 }
  );

  const posts = (data?.posts ?? []).filter(
    (post) =>
      post.status !== 'ARCHIVED' &&
      (canManage || post.createdById === currentUserId)
  );

  useEffect(() => {
    if (open) {
      setSelectedPostId(task.post?.id ?? null);
    }
  }, [open, task]);

  const close = () => {
    if (linkPost.isPending) return;
    onClose();
  };

  const link = () => {
    if (!selectedPostId) return;
    linkPost.mutate(
      { workspaceId, taskId: task.id, postId: selectedPostId },
      { onSuccess: close }
    );
  };

  const unlink = () => {
    linkPost.mutate({ workspaceId, taskId: task.id, postId: null }, { onSuccess: close });
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Gắn bài viết"
      className="max-w-lg"
      footer={
        <>
          {task.post ? (
            <Button
              type="button"
              variant="ghost"
              onClick={unlink}
              disabled={linkPost.isPending}
              className="mr-auto text-danger hover:bg-danger/10"
            >
              Bỏ gắn bài
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={close} disabled={linkPost.isPending}>
            Huỷ
          </Button>
          <Button
            type="button"
            onClick={link}
            disabled={!selectedPostId || selectedPostId === task.post?.id}
            isLoading={linkPost.isPending}
          >
            Gắn bài
          </Button>
        </>
      }
    >
      {isLoading ? <p className="text-sm text-muted">Đang tải bài viết...</p> : null}

      {!isLoading && posts.length === 0 ? (
        <p className="text-sm text-muted">Chưa có bài viết nào có thể gắn.</p>
      ) : null}

      {posts.length > 0 ? (
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {posts.map((post) => (
            <button
              key={post.id}
              type="button"
              aria-pressed={selectedPostId === post.id}
              onClick={() => setSelectedPostId(post.id)}
              className={cn(
                'w-full rounded-xl border p-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                selectedPostId === post.id
                  ? 'border-accent bg-accent/10'
                  : 'border-border hover:bg-surface-2'
              )}
            >
              <span className="block truncate text-sm font-medium text-foreground">
                {post.title}
              </span>
              <span className="mt-1 flex items-center gap-2 text-xs text-muted">
                <PostStatusBadge status={post.status} />
                {formatDate(post.createdAt)}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </Modal>
  );
};

export default TaskLinkPostModal;
