import { Link } from 'react-router-dom';
import Avatar from '@/components/ui/Avatar';
import { ChannelPlatformBadge } from '@/components/features/channel/ChannelPlatformBadge';
import type { ChannelConnection } from '@/services/channel';

const CHANNEL_CHIP_CLASS =
  'flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-border py-1 pl-1.5 pr-3 transition hover:bg-surface-2 has-[:checked]:border-accent has-[:checked]:bg-surface-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60';

interface AiChannelPickerProps {
  channels: ChannelConnection[];
  selectedIds: string[];
  isLoading: boolean;
  isError: boolean;
  disabled: boolean;
  onToggle: (channelId: string) => void;
}

const ChannelChips = ({
  channels,
  selectedIds,
  disabled,
  onToggle,
}: Pick<AiChannelPickerProps, 'channels' | 'selectedIds' | 'disabled' | 'onToggle'>) => {
  const missing = selectedIds.length === 0;
  const hasThreads = channels.some(
    (channel) => channel.platform === 'THREADS' && selectedIds.includes(channel.id)
  );

  return (
    <>
      <div className="mt-2 flex flex-wrap gap-2">
        {channels.map((channel) => (
          <label key={channel.id} className={CHANNEL_CHIP_CLASS}>
            <input
              type="checkbox"
              className="sr-only"
              disabled={disabled}
              checked={selectedIds.includes(channel.id)}
              onChange={() => onToggle(channel.id)}
            />
            <Avatar
              name={channel.label ?? channel.name}
              src={channel.avatar}
              className="h-6 w-6"
            />
            <span className="max-w-32 truncate text-sm text-foreground">
              {channel.label ?? channel.name}
            </span>
            <ChannelPlatformBadge platform={channel.platform} />
          </label>
        ))}
      </div>
      {missing ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          Chọn ít nhất một kênh.
        </p>
      ) : null}
      {!missing && hasThreads ? (
        <p className="mt-2 text-xs text-subtle">
          Threads giới hạn 500 ký tự nên nội dung sẽ được viết ngắn gọn.
        </p>
      ) : null}
    </>
  );
};

const ChannelListBody = ({ isLoading, isError, ...chips }: AiChannelPickerProps) => {
  if (isLoading) {
    return (
      <p role="status" className="mt-2 text-xs text-muted">
        Đang tải danh sách kênh...
      </p>
    );
  }

  if (isError) {
    return (
      <p role="alert" className="mt-2 text-sm text-danger">
        Không tải được danh sách kênh. Vui lòng thử lại.
      </p>
    );
  }

  if (chips.channels.length === 0) {
    return (
      <p className="mt-2 rounded-lg border border-border bg-surface-2 p-3 text-xs text-muted">
        Chưa kết nối kênh nào.{' '}
        <Link
          to="/channels"
          className="font-medium text-accent-text underline-offset-2 hover:underline"
        >
          Kết nối kênh
        </Link>{' '}
        để nội dung được tối ưu theo kênh.
      </p>
    );
  }

  return <ChannelChips {...chips} />;
};

export const AiChannelPicker = (props: AiChannelPickerProps) => (
  <div>
    <p className="text-sm font-medium text-foreground">Kênh đăng bài</p>
    <p className="mt-0.5 text-xs text-muted">
      AI viết một bài đăng được trên tất cả kênh đã chọn.
    </p>
    <ChannelListBody {...props} />
  </div>
);

export default AiChannelPicker;
