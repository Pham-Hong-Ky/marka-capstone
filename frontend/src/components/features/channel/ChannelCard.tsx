import { RefreshCw, Unplug } from 'lucide-react';
import { Link } from 'react-router-dom';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import type { ChannelConnection } from '@/services/channel';
import { formatDate } from '@/utils/format';
import ChannelPlatformBadge from './ChannelPlatformBadge';
import ChannelStatusBadge from './ChannelStatusBadge';

export const ChannelCard = ({
  channel,
  canManage,
  isDisconnecting,
  onReconnect,
  onDisconnect,
}: {
  channel: ChannelConnection;
  canManage: boolean;
  isDisconnecting: boolean;
  onReconnect: (channel: ChannelConnection) => void;
  onDisconnect: (channel: ChannelConnection) => void;
}) => (
  <article className="flex flex-col rounded-xl border border-border bg-surface p-4">
    <div className="flex items-start gap-3">
      <Avatar name={channel.name} src={channel.avatar} className="h-10 w-10" />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-[13px] font-semibold text-foreground">
            {channel.label ?? channel.name}
          </h3>
          <ChannelPlatformBadge platform={channel.platform} />
          <ChannelStatusBadge status={channel.status} />
        </div>

        <p className="mt-1 text-[11px] text-muted">Kết nối ngày {formatDate(channel.createdAt)}</p>

        <Link
          to={`/channels/${channel.id}`}
          aria-label={`Xem chi tiết ${channel.label ?? channel.name}`}
          className="mt-2 inline-flex min-h-11 items-center text-[13px] text-accent-text hover:underline"
        >
          Xem chi tiết
        </Link>
      </div>
    </div>

    {canManage ? (
      <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => onReconnect(channel)}
        >
          <RefreshCw className="h-4 w-4" />
          Kết nối lại
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 text-danger hover:bg-danger/10"
          disabled={isDisconnecting}
          onClick={() => onDisconnect(channel)}
        >
          <Unplug className="h-4 w-4" />
          Ngắt kết nối
        </Button>
      </div>
    ) : null}
  </article>
);

export default ChannelCard;
