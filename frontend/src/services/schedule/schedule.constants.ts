import type { ScheduleStatus } from './schedule.types';

export const SCHEDULE_STATUS_LABELS: Record<ScheduleStatus, string> = {
  SCHEDULED: 'Sắp đăng',
  PROCESSING: 'Đang đăng',
  PUBLISHED: 'Đã đăng',
  FAILED: 'Đăng lỗi',
  CANCELLED: 'Đã huỷ',
};

export const SCHEDULE_STATUS_BADGE_CLASSES: Record<ScheduleStatus, string> = {
  SCHEDULED: 'bg-accent/10 text-accent-text',
  PROCESSING: 'bg-warning/10 text-warning',
  PUBLISHED: 'bg-success/10 text-success',
  FAILED: 'bg-danger/10 text-danger',
  CANCELLED: 'bg-surface-2 text-muted',
};

export const SCHEDULE_STATUS_DOT_CLASSES: Record<ScheduleStatus, string> = {
  SCHEDULED: 'bg-accent',
  PROCESSING: 'bg-warning',
  PUBLISHED: 'bg-success',
  FAILED: 'bg-danger',
  CANCELLED: 'bg-subtle',
};

export const OCCUPIED_SCHEDULE_STATUSES: ScheduleStatus[] = ['SCHEDULED', 'PROCESSING', 'PUBLISHED'];

export interface ScheduleStatusTab {
  value: ScheduleStatus | null;
  label: string;
}

export const SCHEDULE_STATUS_TABS: ScheduleStatusTab[] = [
  { value: null, label: 'Tất cả' },
  { value: 'SCHEDULED', label: 'Sắp đăng' },
  { value: 'PROCESSING', label: 'Đang đăng' },
  { value: 'PUBLISHED', label: 'Đã đăng' },
  { value: 'FAILED', label: 'Đăng lỗi' },
  { value: 'CANCELLED', label: 'Đã huỷ' },
];
