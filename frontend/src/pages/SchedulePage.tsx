import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addMonths, format, isSameMonth, set, startOfMonth } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Alert from '@/components/ui/Alert';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import PageContainer from '@/components/ui/PageContainer';
import PageHeader from '@/components/ui/PageHeader';
import { SkeletonBlock } from '@/components/ui/Skeleton';
import ScheduleStatusBadge from '@/components/features/schedule/ScheduleStatusBadge';
import ScheduleCalendar from '@/components/features/schedule/ScheduleCalendar';
import RescheduleScheduleModal from '@/components/features/schedule/RescheduleScheduleModal';
import { useActiveWorkspace } from '@/hooks/useWorkspace';
import { useCancelSchedule, useRescheduleSchedule, useSchedules } from '@/hooks/useSchedule';
import { useAuthStore } from '@/stores/auth.store';
import { canManagePost } from '@/services/post';
import { buildExternalPostUrl } from '@/services/channel';
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
  const currentUserId = useAuthStore((state) => state.user?.id ?? null);

  const [status, setStatus] = useState<ScheduleStatus | null>(null);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [scheduleToCancel, setScheduleToCancel] = useState<ScheduleItem | null>(null);
  const [scheduleToReschedule, setScheduleToReschedule] = useState<ScheduleItem | null>(null);

  const range = getCalendarRange(month);
  const { data, isLoading, isError, error } = useSchedules(workspaceId, {
    status: status ?? undefined,
    from: range.start.toISOString(),
    to: range.end.toISOString(),
    limit: CALENDAR_LIMIT,
  });
  const cancelSchedule = useCancelSchedule(workspaceId);
  const rescheduleSchedule = useRescheduleSchedule(workspaceId);
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

  const canReschedule = (schedule: ScheduleItem) =>
    Boolean(
      activeWorkspace &&
        schedule.status === 'SCHEDULED' &&
        schedule.scheduledAt &&
        canManagePost(schedule.post, currentUserId, activeWorkspace.role)
    );

  const hasReschedulableSchedules = (data?.schedules ?? []).some(canReschedule);

  const handleRescheduleDrop = (schedule: ScheduleItem, day: Date) => {
    if (!schedule.scheduledAt || !canReschedule(schedule) || rescheduleSchedule.isPending) return;

    const current = new Date(schedule.scheduledAt);
    const next = set(day, {
      hours: current.getHours(),
      minutes: current.getMinutes(),
      seconds: 0,
      milliseconds: 0,
    });

    if (next.getTime() === current.getTime()) return;

    if (next.getTime() < Date.now() + 60_000) {
      toast.error('Không thể đổi về thời điểm đã qua. Dùng nút "Đổi lịch" để chọn giờ mới.');
      return;
    }

    rescheduleSchedule.mutate({
      scheduleId: schedule.id,
      scheduledAt: next.toISOString(),
    });
  };

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
    <PageContainer width="wide">
      <PageHeader
        title="Lịch xuất bản"
        description="Theo dõi các bài đã lên lịch, đang đăng và đã đăng lên các kênh đã kết nối."
      />

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3 lg:flex-row lg:items-center lg:justify-between">
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
          <h2 className="min-w-36 text-center text-sm font-semibold capitalize text-foreground">
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
            className="ml-1 min-h-11"
            onClick={() => changeMonth(new Date())}
          >
            Hôm nay
          </Button>
        </div>

        <div
          role="group"
          aria-label="Lọc theo trạng thái"
          className="flex flex-wrap gap-1 rounded-lg bg-surface-2 p-1"
        >
          {SCHEDULE_STATUS_TABS.map((tab) => {
            const active = status === tab.value;

            return (
              <button
                key={tab.value ?? 'all'}
                type="button"
                aria-pressed={active}
                onClick={() => setStatus(tab.value)}
                className={cn(
                  'min-h-11 rounded-md px-3 text-[12px] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                  active
                    ? 'bg-surface text-foreground shadow-sm'
                    : 'text-muted hover:text-foreground'
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {isError ? (
        <Alert variant="danger" title="Không tải được lịch xuất bản">
          {getErrorMessage(error)}
        </Alert>
      ) : null}

      {isLoading ? (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
          <SkeletonBlock className="h-[520px]" />
          <SkeletonBlock className="h-80" />
        </div>
      ) : (
        <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-3">
            <ScheduleCalendar
              month={month}
              schedulesByDay={schedulesByDay}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              canDragSchedule={(schedule) => canReschedule(schedule) && !rescheduleSchedule.isPending}
              onDropSchedule={handleRescheduleDrop}
            />

            {hasReschedulableSchedules ? (
              <p className="text-[11px] text-muted">
                Trên máy tính, kéo lịch sang ngày khác để đổi ngày nhanh; bấm “Đổi lịch” để chọn
                giờ chính xác.
              </p>
            ) : null}

            {isTruncated ? (
              <p className="text-[11px] text-muted">
                Tháng này có hơn {CALENDAR_LIMIT} lịch đăng, chỉ hiển thị {CALENDAR_LIMIT} lịch đầu
                tiên. Dùng bộ lọc trạng thái để thu hẹp.
              </p>
            ) : null}
          </div>

          <aside className="lg:sticky lg:top-20">
            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
                    Ngày đang chọn
                  </p>
                  <h2 className="mt-0.5 truncate text-sm font-semibold capitalize text-foreground">
                    {format(selectedDate, 'EEEE, dd/MM/yyyy', { locale: vi })}
                  </h2>
                </div>
                <span className="shrink-0 rounded-md bg-surface-2 px-2 py-1 text-[11px] text-muted">
                  {schedules.length} lịch
                </span>
              </div>

              <div className="mt-3 space-y-2">
                {schedules.length === 0 ? (
                  <EmptyState
                    icon={CalendarDays}
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
                    className="border-0 px-0 py-6"
                  />
                ) : (
                  schedules.map((schedule) => {
                    const postUrl = buildExternalPostUrl(
                      schedule.channel.platform,
                      schedule.externalPostId
                    );

                    return (
                      <article
                        key={schedule.id}
                        className="rounded-lg border border-border bg-surface-2/40 p-3"
                      >
                        <div className="flex items-start gap-2.5">
                          <Avatar
                            name={getDisplayName(schedule.channel)}
                            src={schedule.channel.avatar}
                            className="h-8 w-8"
                          />

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <h3 className="truncate text-[13px] font-semibold text-foreground">
                                {schedule.post.title}
                              </h3>
                              <ScheduleStatusBadge status={schedule.status} />
                            </div>

                            <p className="mt-0.5 text-[11px] text-muted">
                              {getDisplayName(schedule.channel)} ·{' '}
                              {format(getScheduleDate(schedule), 'HH:mm')}
                              {schedule.scheduledAt ? '' : ' · Đăng ngay'}
                            </p>

                            {schedule.errorMessage ? (
                              <p className="mt-1 text-[11px] text-danger">{schedule.errorMessage}</p>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-1">
                          {postUrl ? (
                            <a
                              href={postUrl}
                              target="_blank"
                              rel="noreferrer"
                              aria-label="Xem bài đăng"
                              title="Xem bài đăng"
                              className="inline-grid h-11 w-11 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-foreground"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          ) : null}

                          {canReschedule(schedule) ? (
                            <Button
                              type="button"
                              variant="ghost"
                              aria-label="Đổi lịch"
                              title="Đổi lịch"
                              className="h-11 w-11 px-0"
                              disabled={rescheduleSchedule.isPending}
                              onClick={() => setScheduleToReschedule(schedule)}
                            >
                              <CalendarClock className="h-4 w-4" />
                            </Button>
                          ) : null}

                          {schedule.status === 'SCHEDULED' &&
                          activeWorkspace &&
                          canManagePost(schedule.post, currentUserId, activeWorkspace.role) ? (
                            <Button
                              type="button"
                              variant="ghost"
                              aria-label="Huỷ lịch"
                              title="Huỷ lịch"
                              className="h-11 w-11 px-0 text-danger hover:bg-danger/10"
                              disabled={cancelSchedule.isPending}
                              onClick={() => setScheduleToCancel(schedule)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </div>
          </aside>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(scheduleToCancel)}
        onClose={() => setScheduleToCancel(null)}
        title="Huỷ lịch đăng?"
        description={`Huỷ lịch đăng "${scheduleToCancel?.post.title ?? ''}" lên ${
          scheduleToCancel ? getDisplayName(scheduleToCancel.channel) : 'kênh'
        }? Bài viết sẽ quay về trạng thái đã duyệt.`}
        confirmLabel="Huỷ lịch"
        tone="danger"
        isLoading={cancelSchedule.isPending}
        onConfirm={confirmCancel}
      />

      <RescheduleScheduleModal
        open={Boolean(scheduleToReschedule)}
        workspaceId={workspaceId}
        schedule={scheduleToReschedule}
        channelLabel={
          scheduleToReschedule ? getDisplayName(scheduleToReschedule.channel) : undefined
        }
        onClose={() => setScheduleToReschedule(null)}
      />
    </PageContainer>
  );
};

export default SchedulePage;
