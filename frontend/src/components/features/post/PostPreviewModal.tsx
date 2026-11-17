import { useState } from 'react';
import type { JSONContent } from '@tiptap/react';
import ImageLightbox from '@/components/ui/ImageLightbox';
import Modal from '@/components/ui/Modal';
import RichTextEditor from '@/components/ui/RichTextEditor';
import type { PostDetail } from '@/services/post';
import ZoomableImage from './ZoomableImage';

export const PostPreviewModal = ({
  open,
  onClose,
  post,
}: {
  open: boolean;
  onClose: () => void;
  post: PostDetail | null;
}) => {
  const [viewUrl, setViewUrl] = useState<string | null>(null);

  return (
    <Modal open={open} onClose={onClose} title="Xem bài viết" className="max-w-2xl">
      {post ? (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">{post.title}</h3>

          <RichTextEditor value={post.content as JSONContent} editable={false} />

          {post.mediaAssets.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {post.mediaAssets.map((media) => (
                <div key={media.id} className="overflow-hidden rounded-lg border border-border">
                  <ZoomableImage url={media.url} onView={setViewUrl} className="h-32" />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-subtle">Bài viết không có ảnh.</p>
          )}
        </div>
      ) : null}
      <ImageLightbox src={viewUrl} onClose={() => setViewUrl(null)} />
    </Modal>
  );
};

export default PostPreviewModal;
