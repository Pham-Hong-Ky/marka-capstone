import { POST_STATUS_BADGE_CLASSES, POST_STATUS_LABELS, type PostStatus } from '@/services/post';
import { cn } from '@/utils/cn';

export const PostStatusBadge = ({ status }: { status: PostStatus }) => (
  <span
    className={cn(
      'inline-block rounded-full px-2.5 py-0.5 text-xs font-medium',
      POST_STATUS_BADGE_CLASSES[status]
    )}
  >
    {POST_STATUS_LABELS[status]}
  </span>
);

export default PostStatusBadge;
