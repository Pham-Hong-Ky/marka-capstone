import ScheduleStatusBadge from '@/components/features/schedule/ScheduleStatusBadge';
import { buildExternalPostUrl } from '@/services/channel';
import type { ScheduleItem } from '@/services/schedule';
import { formatDateTime } from '@/utils/format';

const getScheduleTime = (schedule: ScheduleItem): string => {
  if (schedule.publishedAt) return formatDateTime(schedule.publishedAt);
  if (schedule.scheduledAt) return formatDateTime(schedule.scheduledAt);
  return 'Đăng ngay';
};

export const PostScheduleList = ({ schedules }: { schedules: ScheduleItem[] }) => {
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
