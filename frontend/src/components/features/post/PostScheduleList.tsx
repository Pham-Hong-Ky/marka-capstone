import { CalendarClock } from 'lucide-react';
import Button from '@/components/ui/Button';
import ScheduleStatusBadge from '@/components/features/schedule/ScheduleStatusBadge';
import { buildExternalPostUrl } from '@/services/channel';
import type { ScheduleItem } from '@/services/schedule';
import { formatDateTime } from '@/utils/format';

const getScheduleTime = (schedule: ScheduleItem): string => {
  if (schedule.publishedAt) return formatDateTime(schedule.publishedAt);
  if (schedule.scheduledAt) return formatDateTime(schedule.scheduledAt);
  return 'Đăng ngay';
};

export const PostScheduleList = ({
  schedules,
  canReschedule,
  onReschedule,
}: {
  schedules: ScheduleItem[];
  canReschedule?: (schedule: ScheduleItem) => boolean;
  onReschedule?: (schedule: ScheduleItem) => void;
}) => {
  if (schedules.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-foreground">Lịch đăng</h3>
      {schedules.map((schedule) => {
        const postUrl = buildExternalPostUrl(schedule.channel.platform, schedule.externalPostId);

        return (
          <div key={schedule.id} className="rounded-lg border border-border p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground">{schedule.channel.name}</span>
              <ScheduleStatusBadge status={schedule.status} />
              <span className="text-xs text-muted">{getScheduleTime(schedule)}</span>
              {canReschedule?.(schedule) && onReschedule ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="ml-auto min-h-11 px-3"
                  onClick={() => onReschedule(schedule)}
                >
                  <CalendarClock className="h-4 w-4" />
                  Đổi lịch
                </Button>
              ) : null}
            </div>
            {schedule.errorMessage ? (
              <p className="mt-1 text-danger">{schedule.errorMessage}</p>
            ) : null}
            {postUrl ? (
              <a
                href={postUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-xs font-medium text-accent-text hover:underline"
              >
                Xem bài trên Facebook
              </a>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

export default PostScheduleList;
