import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Send } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import Modal from '@/components/ui/Modal';
import TextField from '@/components/ui/TextField';
import { useChannels } from '@/hooks/useChannels';
import { useCreateSchedules } from '@/hooks/useSchedule';
import type { PostDetail } from '@/services/post';
import { OCCUPIED_SCHEDULE_STATUSES } from '@/services/schedule';
import { getErrorMessage } from '@/utils/error';

const toLocalInputValue = (date: Date): string => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

const defaultScheduleTime = (): string => toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000));

export const PublishScheduleModal = ({
  open,
  mode,
  workspaceId,
  post,
  onClose,
  onScheduled,
}: {
  open: boolean;
  mode: 'now' | 'schedule';
  workspaceId: string;
  post: PostDetail;
  onClose: () => void;
  onScheduled: () => void;
}) => {
  const { data, isLoading, isError, error } = useChannels(open ? workspaceId : null);
  const createSchedules = useCreateSchedules(workspaceId);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = useState(defaultScheduleTime);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!open) return;
    setSelectedIds([]);
    setScheduledAt(defaultScheduleTime());
    setFormError('');
  }, [open, mode, post.id]);

  const occupiedChannelIds = new Set(
    post.schedules
      .filter((schedule) => OCCUPIED_SCHEDULE_STATUSES.includes(schedule.status))
      .map((schedule) => schedule.channelId)
  );
  const activeChannels = (data?.channels ?? []).filter(
    (channel) => channel.platform === 'FACEBOOK' && channel.status === 'ACTIVE'
  );
  const channels = activeChannels.filter((channel) => !occupiedChannelIds.has(channel.id));
  const imageCount = post.mediaAssets.filter((media) => media.type === 'IMAGE').length;

  const toggleChannel = (channelId: string) => {
    setSelectedIds((current) =>
      current.includes(channelId)
        ? current.filter((id) => id !== channelId)
        : [...current, channelId]
    );
  };

  const handleSubmit = () => {
    setFormError('');

    if (selectedIds.length === 0) {
      setFormError('Chọn ít nhất một Page để đăng bài');
      return;
    }

    let scheduledAtIso: string | null = null;
    if (mode === 'schedule') {
      if (!scheduledAt) {
        setFormError('Chọn thời gian đăng bài');
        return;
      }

      const date = new Date(scheduledAt);
      if (Number.isNaN(date.getTime())) {
        setFormError('Thời gian đăng bài không hợp lệ');
        return;
      }
      if (date.getTime() < Date.now() + 60_000) {
        setFormError('Thời gian đăng phải sau hiện tại ít nhất 1 phút');
        return;
      }
      scheduledAtIso = date.toISOString();
    }

    createSchedules.mutate(
      {
        postId: post.id,
        payload: { channelIds: selectedIds, scheduledAt: scheduledAtIso },
      },
      {
        onSuccess: () => {
          onScheduled();
          onClose();
        },
      }
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'now' ? 'Đăng bài ngay' : 'Lên lịch đăng bài'}
      className="max-w-lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={createSchedules.isPending}>
            Hủy
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            isLoading={createSchedules.isPending}
            disabled={channels.length === 0 || imageCount > 10}
          >
            {mode === 'now' ? (
              <>
                <Send className="h-4 w-4" />
                Đăng ngay
              </>
            ) : (
              <>
                <CalendarClock className="h-4 w-4" />
                Lên lịch
              </>
            )}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-muted">
          <span className="font-medium text-foreground">{post.title}</span>
          <span className="ml-2">
            · {imageCount} ảnh
            {imageCount > 10 ? ' (quá giới hạn 10 ảnh)' : ''}
          </span>
        </div>

        {mode === 'schedule' ? (
          <TextField
            label="Thời gian đăng"
            name="scheduledAt"
            type="datetime-local"
            value={scheduledAt}
            min={toLocalInputValue(new Date(Date.now() + 60_000))}
            onChange={(event) => setScheduledAt(event.target.value)}
          />
        ) : null}

        {isLoading ? <p className="text-sm text-muted">Đang tải danh sách Page...</p> : null}

        {isError ? <p className="text-sm text-danger">{getErrorMessage(error)}</p> : null}

        {!isLoading && !isError && channels.length === 0 && activeChannels.length > 0 ? (
          <EmptyState
            title="Không còn Page nào để đăng."
            description="Bài viết đã được đăng hoặc đang chờ đăng trên tất cả Page đang kết nối."
          />
        ) : null}

        {!isLoading && !isError && activeChannels.length === 0 ? (
          <EmptyState
            title="Chưa có Page nào khả dụng."
            description="Workspace cần kết nối ít nhất một Facebook Page đang hoạt động."
            action={
              <Link to="/channels" className="text-sm font-medium text-accent-text hover:underline">
                Đi tới Kênh kết nối
              </Link>
            }
          />
        ) : null}

        {channels.length > 0 ? (
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {channels.map((channel) => (
              <label
                key={channel.id}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border p-3 transition hover:bg-surface-2"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-accent"
                  checked={selectedIds.includes(channel.id)}
                  onChange={() => toggleChannel(channel.id)}
                />
                <Avatar
                  name={channel.label ?? channel.name}
                  src={channel.avatar}
                  className="h-9 w-9"
                />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {channel.label ?? channel.name}
                </span>
              </label>
            ))}
          </div>
        ) : null}

        {formError ? <p className="text-sm text-danger">{formError}</p> : null}
      </div>
    </Modal>
  );
};

export default PublishScheduleModal;
