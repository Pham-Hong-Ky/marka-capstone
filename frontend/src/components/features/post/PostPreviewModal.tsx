import type { JSONContent } from '@tiptap/react';
import Modal from '@/components/ui/Modal';
import RichTextEditor from '@/components/ui/RichTextEditor';
import type { PostDetail } from '@/services/post';

export const PostPreviewModal = ({
  open,
  onClose,
  post,
}: {
  open: boolean;
  onClose: () => void;
  post: PostDetail | null;
}) => (
  <Modal open={open} onClose={onClose} title="Xem bài viết" className="max-w-2xl">
    {post ? (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">{post.title}</h3>

        <RichTextEditor value={post.content as JSONContent} editable={false} />

        {post.mediaAssets.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {post.mediaAssets.map((media) => (
              <img
                key={media.id}
                src={media.url}
                alt=""
                className="h-32 w-full rounded-lg border border-border object-cover"
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-subtle">Bài viết không có ảnh.</p>
        )}
      </div>
    ) : null}
  </Modal>
);

export default PostPreviewModal;
