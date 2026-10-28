import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addMonths, format, isSameMonth, startOfMonth } from 'date-fns';
import { vi } from 'date-fns/locale';
import { CalendarDays, ChevronLeft, ChevronRight, ExternalLink, Trash2 } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import { SkeletonBlock } from '@/components/ui/Skeleton';
import ScheduleStatusBadge from '@/components/features/schedule/ScheduleStatusBadge';
import ScheduleCalendar from '@/components/features/schedule/ScheduleCalendar';
import { useActiveWorkspace } from '@/hooks/useWorkspace';
import { useCancelSchedule, useSchedules } from '@/hooks/useSchedule';
import { useChannels } from '@/hooks/useChannels';
import {
  SCHEDULE_STATUS_TABS,
  type ScheduleChannel,
  type ScheduleItem,
  type ScheduleStatus,
} from '@/services/schedule';
import { getErrorMessage } from '@/utils/error';
import { cn } from '@/utils/cn';
import { getCalendarRange, getScheduleDate, toDayKey } from '@/utils/schedule';

const CALENDAR_LIMIT = 200;

export const SchedulePage = () => {
  const navigate = useNavigate();
  const activeWorkspace = useActiveWorkspace();
  const workspaceId = activeWorkspace?.id ?? null;

  const [status, setStatus] = useState<ScheduleStatus | null>(null);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [scheduleToCancel, setScheduleToCancel] = useState<ScheduleItem | null>(null);

  const range = getCalendarRange(month);
  const { data, isLoading, isError, error } = useSchedules(workspaceId, {
    status: status ?? undefined,
    from: range.start.toISOString(),
    to: range.end.toISOString(),
    limit: CALENDAR_LIMIT,
  });
  const cancelSchedule = useCancelSchedule(workspaceId);
  const { data: channelsData } = useChannels(workspaceId);

  const channelDisplayNames = useMemo(() => {
    const names = new Map<string, string>();
    for (const channel of channelsData?.channels ?? []) {
      names.set(channel.id, channel.label ?? channel.name);
    }
    return names;
  }, [channelsData?.channels]);

  const schedulesByDay = useMemo(() => {
    const groups = new Map<string, ScheduleItem[]>();
    for (const schedule of data?.schedules ?? []) {
      const key = toDayKey(getScheduleDate(schedule));
      groups.set(key, [...(groups.get(key) ?? []), schedule]);
    }
    groups.forEach((items) =>
      items.sort((a, b) => getScheduleDate(a).getTime() - getScheduleDate(b).getTime())
    );
    return groups;
  }, [data?.schedules]);

  if (!workspaceId) {
    return <EmptyState title="Bạn chưa có workspace nào." />;
  }

  const schedules = schedulesByDay.get(toDayKey(selectedDate)) ?? [];
  const isTruncated = Boolean(data && data.meta.total > data.schedules.length);

  const getDisplayName = (channel: ScheduleChannel) =>
    channelDisplayNames.get(channel.id) ?? channel.name;

  const changeMonth = (next: Date) => {
    const nextMonth = startOfMonth(next);
    setMonth(nextMonth);
    setSelectedDate(isSameMonth(new Date(), nextMonth) ? new Date() : nextMonth);
  };

  const confirmCancel = () => {
    if (!scheduleToCancel) return;
    cancelSchedule.mutate(scheduleToCancel.id, {
      onSuccess: () => setScheduleToCancel(null),
    });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Lịch xuất bản"
        description="Theo dõi các bài đã lên lịch, đang đăng và đã đăng lên các kênh đã kết nối."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 px-3"
            aria-label="Tháng trước"
            onClick={() => changeMonth(addMonths(month, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="min-w-36 text-center text-base font-semibold capitalize text-foreground">
            {format(month, 'LLLL yyyy', { locale: vi })}
          </h2>
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 px-3"
            aria-label="Tháng sau"
            onClick={() => changeMonth(addMonths(month, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            className="ml-2 min-h-11"
            onClick={() => changeMonth(new Date())}
          >
            Hôm nay
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {SCHEDULE_STATUS_TABS.map((tab) => (
            <button
              key={tab.value ?? 'all'}
              type="button"
              onClick={() => setStatus(tab.value)}
              className={cn(
                'min-h-11 rounded-full border px-4 text-sm font-medium transition',
                status === tab.value
                  ? 'border-accent bg-accent/10 text-accent-text'
                  : 'border-border text-muted hover:bg-surface-2 hover:text-foreground'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {isError ? <p className="text-sm text-danger">{getErrorMessage(error)}</p> : null}

      {isLoading ? (
        <SkeletonBlock className="h-96" />
      ) : (
        <ScheduleCalendar
          month={month}
          schedulesByDay={schedulesByDay}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />
      )}

      {isTruncated ? (
        <p className="text-xs text-muted">
          Tháng này có hơn {CALENDAR_LIMIT} lịch đăng, chỉ hiển thị {CALENDAR_LIMIT} lịch đầu tiên.
          Dùng bộ lọc trạng thái để thu hẹp.
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground first-letter:uppercase">
          {format(selectedDate, "EEEE, dd/MM/yyyy", { locale: vi })}
        </h2>

        {!isLoading && !isError && schedules.length === 0 ? (
          <EmptyState
            title="Không có bài đăng nào trong ngày này."
            description={
              status
                ? 'Không có lịch nào ở trạng thái này.'
                : 'Vào một bài đã duyệt và chọn "Đăng ngay" hoặc "Lên lịch" để bắt đầu.'
            }
            action={
              <Button type="button" variant="outline" onClick={() => navigate('/posts')}>
                <CalendarDays className="h-4 w-4" />
                Đi tới bài viết
              </Button>
            }
          />
        ) : null}

        {schedules.map((schedule) => (
          <article
            key={schedule.id}
            className="rounded-2xl border border-border bg-surface p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-start gap-4">
              <Avatar
                name={getDisplayName(schedule.channel)}
                src={schedule.channel.avatar}
                className="h-10 w-10"
              />

              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-sm font-semibold text-foreground">
                    {schedule.post.title}
                  </h3>
                  <ScheduleStatusBadge status={schedule.status} />
                </div>

                <p className="text-sm text-muted">
                  {getDisplayName(schedule.channel)} · {format(getScheduleDate(schedule), 'HH:mm')}
                  {schedule.scheduledAt ? '' : ' · Đăng ngay'}
                </p>

                {schedule.errorMessage ? (
                  <p className="text-sm text-danger">{schedule.errorMessage}</p>
                ) : null}
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {schedule.externalPostId && schedule.channel.platform === 'FACEBOOK' ? (
                  <a
                    href={`https://www.facebook.com/${schedule.externalPostId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-accent-text transition hover:bg-accent/10"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Xem bài
                  </a>
                ) : null}

                {schedule.status === 'SCHEDULED' ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-11 text-danger hover:bg-danger/10"
                    disabled={cancelSchedule.isPending}
                    onClick={() => setScheduleToCancel(schedule)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Huỷ lịch
                  </Button>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </section>

      <ConfirmDialog
        open={Boolean(scheduleToCancel)}
        onClose={() => setScheduleToCancel(null)}
        title="Huỷ lịch đăng?"
        description={`Huỷ lịch đăng "${scheduleToCancel?.post.title ?? ''}" lên ${
          scheduleToCancel ? getDisplayName(scheduleToCancel.channel) : 'k�nh'
        }? Bài viết sẽ quay về trạng thái đã duyệt.`}
        confirmLabel="Huỷ lịch"
        tone="danger"
        isLoading={cancelSchedule.isPending}
        onConfirm={confirmCancel}
      />
    </div>
  );
};

export default SchedulePage;
