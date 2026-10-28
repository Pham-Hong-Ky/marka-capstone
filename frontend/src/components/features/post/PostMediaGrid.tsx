import { Trash2 } from 'lucide-react';
import type { PostMedia } from '@/services/post';

interface PendingMedia {
  file: File;
  url: string;
}

export const PostMediaGrid = ({
  existingMedia,
  pendingMedia,
  isDeleting,
  onDeleteExisting,
  onRemovePending,
}: {
  existingMedia: PostMedia[];
  pendingMedia: PendingMedia[];
  isDeleting: boolean;
  onDeleteExisting: (mediaId: string) => void;
  onRemovePending: (url: string) => void;
}) => {
  if (existingMedia.length + pendingMedia.length === 0) {
    return <p className="text-xs text-subtle">Chưa có ảnh nào.</p>;
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
      {existingMedia.map((media) => (
        <div key={media.id} className="relative overflow-hidden rounded-lg border border-border">
          <img src={media.url} alt="" className="h-24 w-full object-cover" />
          {media.source === 'AI_GENERATED' ? (
            <span
              title="Ảnh tạo bởi AI"
              className="absolute bottom-2 left-2 rounded-md bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-accent-text"
            >
              AI
            </span>
          ) : null}
          <button
            type="button"
            aria-label="Gỡ ảnh"
            disabled={isDeleting}
            onClick={() => onDeleteExisting(media.id)}
            className="absolute right-2 top-2 grid h-11 w-11 place-items-center rounded-lg bg-black/50 text-white transition hover:bg-black/70 disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}

      {pendingMedia.map((item) => (
        <div key={item.url} className="relative overflow-hidden rounded-lg border border-border">
          <img src={item.url} alt="" className="h-24 w-full object-cover" />
          <button
            type="button"
            aria-label="Bỏ ảnh"
            onClick={() => onRemovePending(item.url)}
            className="absolute right-2 top-2 grid h-11 w-11 place-items-center rounded-lg bg-black/50 text-white transition hover:bg-black/70"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default PostMediaGrid;
