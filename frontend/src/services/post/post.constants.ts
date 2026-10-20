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
  PENDING: 'bg-warning/10 text-warning',
  APPROVED: 'bg-success/10 text-success',
  REJECTED: 'bg-danger/10 text-danger',
  SCHEDULED: 'bg-accent/10 text-accent-text',
  PUBLISHED: 'bg-success/10 text-success',
  FAILED: 'bg-danger/10 text-danger',
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
