import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { Download, X } from 'lucide-react';
import { useDialogFocusTrap } from '@/hooks/useDialogFocusTrap';
import { downloadImage } from '@/utils/downloadImage';
import { getErrorMessage } from '@/utils/error';

const ACTION_BUTTON_CLASS =
  'grid h-11 w-11 place-items-center rounded-lg bg-black/50 text-white transition hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60';

export const ImageLightbox = ({
  src,
  onClose,
}: {
  src: string | null;
  onClose: () => void;
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  useDialogFocusTrap(Boolean(src), dialogRef, onClose);

  if (!src) return null;

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await downloadImage(src);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsDownloading(false);
    }
  };

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Xem ảnh chi tiết"
      tabIndex={-1}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 outline-none"
      onClick={onClose}
    >
      <div className="absolute right-4 top-4 flex gap-2">
        <button
          type="button"
          aria-label="Tải ảnh về"
          disabled={isDownloading}
          onClick={(event) => {
            event.stopPropagation();
            void handleDownload();
          }}
          className={ACTION_BUTTON_CLASS}
        >
          <Download className="h-5 w-5" />
        </button>
        <button type="button" aria-label="Đóng" onClick={onClose} className={ACTION_BUTTON_CLASS}>
          <X className="h-5 w-5" />
        </button>
      </div>

      <img
        src={src}
        alt="Ảnh chi tiết"
        className="max-h-full max-w-full object-contain"
        onClick={(event) => event.stopPropagation()}
      />
    </div>,
    document.body
  );
};

export default ImageLightbox;
