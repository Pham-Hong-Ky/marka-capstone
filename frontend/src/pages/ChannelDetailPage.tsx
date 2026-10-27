import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { RefreshCw, Unplug } from 'lucide-react';
import ChannelLabelForm from '@/components/features/channel/ChannelLabelForm';
import ChannelPlatformBadge from '@/components/features/channel/ChannelPlatformBadge';
import ChannelStatsGrid from '@/components/features/channel/ChannelStatsGrid';
import ChannelStatusBadge from '@/components/features/channel/ChannelStatusBadge';
import Alert from '@/components/ui/Alert';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import { SkeletonBlock } from '@/components/ui/Skeleton';
import { useChannelDetail, useDisconnectChannel, useRefreshChannel } from '@/hooks/useChannels';
import { useActiveWorkspace } from '@/hooks/useWorkspace';
import { getChannelPlatformMeta } from '@/services/channel';
import { getErrorMessage, getErrorStatus } from '@/utils/error';
import { formatDate } from '@/utils/format';

const ChannelNotFoundState = () => (
  <EmptyState
    title="Kênh không tồn tại"
    description="Kênh có thể đã bị ngắt kết nối hoặc không thuộc workspace hiện tại."
    action={
      <Link
        to="/channels"
        className="inline-flex min-h-11 items-center text-sm text-accent-text hover:underline"
      >
        Về danh sách kênh
      </Link>
    }
  />
);

export const ChannelDetailPage = () => {
  const { channelId } = useParams();
  const activeWorkspace = useActiveWorkspace();
  const workspaceId = activeWorkspace?.id ?? null;
  const isOwner = activeWorkspace?.role === 'OWNER';
  const navigate = useNavigate();

  const { data, isPending, isFetching, isError, error, refetch } = useChannelDetail(
    workspaceId,
    channelId ?? null
  );
  const refresh = useRefreshChannel(workspaceId, channelId ?? null);
  const disconnect = useDisconnectChannel(workspaceId);

  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!workspaceId) {
    return <EmptyState title="Bạn chưa có workspace nào." />;
  }

  if (!channelId) {
    return <ChannelNotFoundState />;
  }

  if (isPending) {
    return (
      <div className="mx-auto max-w-4xl">
        <SkeletonBlock />
      </div>
    );
  }

  if (isError) {
    if (getErrorStatus(error) === 404) {
      return <ChannelNotFoundState />;
    }

    return (
      <Alert
        variant="danger"
        title="Không tải được thông tin kênh"
        action={
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            isLoading={isFetching}
            onClick={() => void refetch()}
          >
            Thử lại
          </Button>
        }
      >
        {getErrorMessage(error)}
      </Alert>
    );
  }

  if (!data) {
    return <ChannelNotFoundState />;
  }

  const { channel, stats } = data;
  const meta = getChannelPlatformMeta(channel.platform);
  const displayName = channel.label ?? channel.name;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={displayName}
        actions={
          <>
            {meta.capabilities.refreshProfile ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                isLoading={refresh.isPending}
                onClick={() => refresh.mutate()}
              >
                <RefreshCw className="h-4 w-4" />
                Làm mới từ {meta.shortLabel}
              </Button>
            ) : null}

            {isOwner ? (
              <Button
                type="button"
                variant="ghost"
                className="min-h-11 text-danger hover:bg-danger/10"
                onClick={() => setConfirmOpen(true)}
              >
                <Unplug className="h-4 w-4" />
                Ngắt kết nối
              </Button>
            ) : null}
          </>
        }
      />

      <section className="flex flex-wrap items-start gap-4 rounded-2xl border border-border bg-surface p-6">
        <Avatar name={channel.name} src={channel.avatar} className="h-14 w-14" />

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <ChannelPlatformBadge platform={channel.platform} />
            <ChannelStatusBadge status={channel.status} />
          </div>
          <p className="text-sm text-muted">Kết nối ngày {formatDate(channel.createdAt)}</p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">Hiệu quả kênh</h2>
        <ChannelStatsGrid stats={stats} showMetrics={meta.capabilities.metrics} />
      </section>

      <ChannelLabelForm
        key={channel.id}
        workspaceId={workspaceId}
        channelId={channel.id}
        label={channel.label}
      />

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Ngắt kết nối kênh?"
        description={`Ngắt kết nối "${displayName}" sẽ huỷ các bài đăng đang chờ trên kênh này. Bạn có chắc chắn?`}
        confirmLabel="Ngắt kết nối"
        tone="danger"
        isLoading={disconnect.isPending}
        onConfirm={() =>
          disconnect.mutate(channel.id, {
            onSuccess: () => {
              setConfirmOpen(false);
              navigate('/channels');
            },
          })
        }
      />
    </div>
  );
};

export default ChannelDetailPage;
