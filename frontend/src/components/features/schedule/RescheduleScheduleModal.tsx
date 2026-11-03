import { useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import TextField from '@/components/ui/TextField';
import { useRescheduleSchedule } from '@/hooks/useSchedule';
import type { ScheduleItem } from '@/services/schedule';
import { formatDateTime, toDateTimeLocalValue } from '@/utils/format';

const MIN_SCHEDULE_AHEAD_MS = 60 * 1000;
const MAX_SCHEDULE_AHEAD_MS = 365 * 24 * 60 * 60 * 1000;

export const RescheduleScheduleModal = ({
  open,
  workspaceId,
  schedule,
  channelLabel,
  onClose,
}: {
  open: boolean;
  workspaceId: string;
  schedule: ScheduleItem | null;
  channelLabel?: string;
  onClose: () => void;
}) => {
  const reschedule = useRescheduleSchedule(workspaceId);
  const [scheduledAt, setScheduledAt] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!open || !schedule?.scheduledAt) return;
    setScheduledAt(toDateTimeLocalValue(schedule.scheduledAt));
    setFormError('');
  }, [open, schedule?.id, schedule?.scheduledAt]);

  if (!schedule) return null;

  const handleSubmit = () => {
    setFormError('');

    if (!scheduledAt) {
      setFormError('Chọn thời gian đăng mới');
      return;
    }

    const date = new Date(scheduledAt);
    if (Number.isNaN(date.getTime())) {
      setFormError('Thời gian đăng không hợp lệ');
      return;
    }

    const diff = date.getTime() - Date.now();
    if (diff < MIN_SCHEDULE_AHEAD_MS) {
      setFormError('Thời gian đăng phải sau hiện tại ít nhất 1 phút');
      return;
    }
    if (diff > MAX_SCHEDULE_AHEAD_MS) {
      setFormError('Thời gian đăng không được vượt quá 1 năm');
      return;
    }

    reschedule.mutate(
      { scheduleId: schedule.id, scheduledAt: date.toISOString() },
      { onSuccess: onClose }
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Đổi lịch đăng bài"
      className="max-w-lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={reschedule.isPending}>
            Hủy
          </Button>
          <Button type="button" onClick={handleSubmit} isLoading={reschedule.isPending}>
            <CalendarClock className="h-4 w-4" />
            Lưu lịch
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-muted">
          <span className="font-medium text-foreground">{schedule.post.title}</span>
          <span className="ml-2">· {channelLabel ?? schedule.channel.name}</span>
        </div>

        <p className="text-sm text-muted">
          Hiện tại:{' '}
          <span className="font-medium text-foreground">
            {schedule.scheduledAt ? formatDateTime(schedule.scheduledAt) : 'Đăng ngay'}
          </span>
        </p>

        <TextField
          label="Thời gian đăng mới"
          name="scheduledAt"
          type="datetime-local"
          value={scheduledAt}
          min={toDateTimeLocalValue(new Date(Date.now() + MIN_SCHEDULE_AHEAD_MS))}
          onChange={(event) => setScheduledAt(event.target.value)}
        />

        {formError ? <p className="text-sm text-danger">{formError}</p> : null}
      </div>
    </Modal>
  );
};

export default RescheduleScheduleModal;
