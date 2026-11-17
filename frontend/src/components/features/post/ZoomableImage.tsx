import { cn } from '@/utils/cn';

export const ZoomableImage = ({
  url,
  onView,
  className,
}: {
  url: string;
  onView: (url: string) => void;
  className?: string;
}) => (
  <button
    type="button"
    aria-label="Xem ảnh chi tiết"
    onClick={() => onView(url)}
    className="block w-full cursor-zoom-in focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
  >
    <img src={url} alt="" className={cn('h-24 w-full object-cover', className)} />
  </button>
);

export default ZoomableImage;
