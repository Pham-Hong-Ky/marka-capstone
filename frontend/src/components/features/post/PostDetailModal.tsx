import { useState } from 'react';
import type { JSONContent } from '@tiptap/react';
import { Check, Eye, Pencil, Send, Trash2, X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import RichTextEditor from '@/components/ui/RichTextEditor';
import PostStatusBadge from './PostStatusBadge';
import PostPreviewModal from './PostPreviewModal';
import type { PostDetail } from '@/services/post';
import { usePost, useReviewPost, useSubmitPost } from '@/hooks/usePost';
import { getErrorMessage } from '@/utils/error';
import type { WorkspaceRole } from '@/services/auth';
import { SkeletonBlock } from '@/components/ui/Skeleton';

export const PostDetailModal = ({
  open,
  onClose,
  workspaceId,
  postId,
  role,
  onEdit,
  onReject,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  postId: string;
  role: WorkspaceRole;
  onEdit: (post: PostDetail) => void;
  onReject: (postId: string) => void;
  onDelete: (post: PostDetail) => void;
}) => {
  const { data: post, isLoading, isError, error } = usePost(
    open ? workspaceId : null,
    open ? postId : null
  );
  const submitPost = useSubmitPost();
  const reviewPost = useReviewPost();
  const [previewOpen, setPreviewOpen] = useState(false);

  const canEdit = post?.status === 'DRAFT' || post?.status === 'REJECTED';
  const canReview = post?.status === 'PENDING' && role === 'OWNER';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={post?.title ?? 'Chi tiết bài viết'}
      className="max-w-2xl"
      footer={
        post && (canEdit || canReview) ? (
          <>
            {canEdit ? (
              <Button type="button" variant="outline" onClick={() => onEdit(post)} className="mr-auto">
                <Pencil className="h-4 w-4" />
                Sửa
              </Button>
            ) : null}

            {canEdit ? (
              <Button
                type="button"
                variant="outline"
                className="text-danger"
                onClick={() => onDelete(post)}
              >
                <Trash2 className="h-4 w-4" />
                Xóa
              </Button>
            ) : null}

            {canEdit ? (
              <Button
                type="button"
                isLoading={submitPost.isPending}
                onClick={() => submitPost.mutate({ workspaceId, postId })}
              >
                <Send className="h-4 w-4" />
                Gửi duyệt
              </Button>
            ) : null}

            {canReview ? (
              <>
                <Button type="button" variant="outline" onClick={() => onReject(postId)}>
                  <X className="h-4 w-4" />
                  Từ chối
                </Button>
                <Button
                  type="button"
                  isLoading={reviewPost.isPending}
                  onClick={() =>
                    reviewPost.mutate({ workspaceId, postId, payload: { decision: 'APPROVED' } })
                  }
                >
                  <Check className="h-4 w-4" />
                  Duyệt
                </Button>
              </>
            ) : null}
          </>
        ) : undefined
      }
    >
      {isLoading ? <SkeletonBlock /> : null}

      {isError ? (
        <p className="text-sm text-danger">{getErrorMessage(error)}</p>
      ) : null}

      {post ? (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <PostStatusBadge status={post.status} />
            <span className="text-xs text-muted">
              Cập nhật {new Date(post.updatedAt).toLocaleString('vi-VN')}
            </span>
          </div>

          {post.status === 'REJECTED' && post.rejectReason ? (
            <div className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm">
              <p className="font-medium text-danger">Lý do từ chối</p>
              <p className="mt-1 text-foreground">{post.rejectReason}</p>
            </div>
          ) : null}

          <div className="rounded-xl border border-border bg-surface-2 p-4">
            <RichTextEditor value={post.content as JSONContent} editable={false} />
          </div>

          <Button type="button" variant="outline" onClick={() => setPreviewOpen(true)}>
            <Eye className="h-4 w-4" />
            Xem bài viết
          </Button>
        </div>
      ) : null}

      <PostPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        post={post ?? null}
      />
    </Modal>
  );
};

export default PostDetailModal;
