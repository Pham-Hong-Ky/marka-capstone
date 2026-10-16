import type { PostStatus } from './post.types';

export const POST_STATUS_LABELS: Record<PostStatus, string> = {
  DRAFT: 'Nháp',
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Bị từ chối',
  SCHEDULED: 'Đã lên lịch',
  PUBLISHED: 'Đã đăng',
  FAILED: 'Đăng lỗi',
  ARCHIVED: 'Lưu trữ',
};

export const POST_STATUS_BADGE_CLASSES: Record<PostStatus, string> = {
  DRAFT: 'bg-surface-2 text-muted',
  PENDING: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  APPROVED: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  REJECTED: 'bg-red-500/10 text-red-600 dark:text-red-400',
  SCHEDULED: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  PUBLISHED: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  FAILED: 'bg-red-500/10 text-red-600 dark:text-red-400',
  ARCHIVED: 'bg-surface-2 text-subtle',
};

export interface PostStatusTab {
  value: PostStatus | null;
  label: string;
}

export const POST_STATUS_TABS: PostStatusTab[] = [
  { value: null, label: 'Tất cả' },
  { value: 'DRAFT', label: 'Nháp' },
  { value: 'PENDING', label: 'Chờ duyệt' },
  { value: 'APPROVED', label: 'Đã duyệt' },
  { value: 'REJECTED', label: 'Bị từ chối' },
];
