import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns';
import type { ScheduleItem } from '@/services/schedule';

export const getCalendarRange = (month: Date) => ({
  start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
  end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
});

// Lịch hiển thị theo đúng mốc backend dùng để lọc khoảng ngày (scheduledAt,
// fallback createdAt). publishedAt có thể lệch ngày khi đăng trễ qua nửa đêm.
export const getScheduleDate = (schedule: ScheduleItem): Date =>
  new Date(schedule.scheduledAt ?? schedule.createdAt);

export const toDayKey = (date: Date): string => format(date, 'yyyy-MM-dd');

export const PUBLISH_POLL_INTERVAL_MS = 5000;

const isDue = (time: string | null): boolean => !time || new Date(time).getTime() <= Date.now();

// Lịch đến hạn hoặc đang đăng sẽ đổi trạng thái trong vài giây → cần polling.
export const hasPublishInProgress = (schedules: ScheduleItem[] = []): boolean =>
  schedules.some(
    (schedule) =>
      schedule.status === 'PROCESSING' ||
      (schedule.status === 'SCHEDULED' && isDue(schedule.retryAt ?? schedule.scheduledAt))
  );
