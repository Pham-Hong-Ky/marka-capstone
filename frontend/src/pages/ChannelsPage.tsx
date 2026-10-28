import { useState } from 'react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import ChannelCard from '@/components/features/channel/ChannelCard';
import ChannelConnectMenu from '@/components/features/channel/ChannelConnectMenu';
import ChannelConnectFlow from '@/components/features/channel/connect/ChannelConnectFlow';
import { useChannels, useDisconnectChannel, useStartChannelOauth } from '@/hooks/useChannels';
import type { ChannelConnection } from '@/services/channel';
import { getErrorMessage } from '@/utils/error';
import { SkeletonList } from '@/components/ui/Skeleton';
import { useActiveWorkspace } from '@/hooks/useWorkspace';

export const ChannelsPage = () => {
  const activeWorkspace = useActiveWorkspace();
  const workspaceId = activeWorkspace?.id ?? null;
  const isOwner = activeWorkspace?.role === 'OWNER';

  const [channelToDisconnect, setChannelToDisconnect] = useState<ChannelConnection | null>(null);

  const { data, isLoading, isError, error } = useChannels(workspaceId);
  const startOauth = useStartChannelOauth();
  const disconnect = useDisconnectChannel(workspaceId);

  if (!workspaceId) {
    return <EmptyState title="Bạn chưa có workspace nào." />;
  }

  const channels = data?.channels ?? [];

  const handleStartOauth = (channel: ChannelConnection) =>
    startOauth.mutate({ platform: channel.platform, workspaceId });

  const confirmDisconnect = () => {
    if (!channelToDisconnect) return;

    disconnect.mutate(channelToDisconnect.id, {
      onSuccess: () => setChannelToDisconnect(null),
    });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Kênh kết nối"
        description="Kết nối nền tảng mạng xã hội để chuẩn bị đăng bài và theo dõi hiệu quả nội dung."
        actions={<ChannelConnectMenu workspaceId={workspaceId} canManage={isOwner} />}
      />

      {isLoading ? <SkeletonList rows={2} /> : null}

      {isError ? (
        <p className="text-sm text-danger">{getErrorMessage(error)}</p>
      ) : null}

      {!isLoading && !isError && channels.length === 0 ? (
        <EmptyState
          title="Chưa có kênh nào được kết nối."
          description={
            isOwner
              ? 'Bấm "Kết nối kênh" để thêm nền tảng bạn muốn quản lý.'
              : 'Workspace Owner cần kết nối kênh trước khi bạn có thể đăng bài.'
          }
        />
      ) : null}

      {channels.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {channels.map((channel) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              canManage={isOwner}
              isDisconnecting={disconnect.isPending && disconnect.variables === channel.id}
              onReconnect={handleStartOauth}
              onDisconnect={setChannelToDisconnect}
            />
          ))}
        </div>
      ) : null}

      <ChannelConnectFlow workspaceId={workspaceId} />

      <ConfirmDialog
        open={Boolean(channelToDisconnect)}
        onClose={() => setChannelToDisconnect(null)}
        title="Ngắt kết nối kênh?"
        description={`Ngắt kết nối "${
          channelToDisconnect?.label ?? channelToDisconnect?.name ?? ''
        }" sẽ huỷ các bài đăng đang chờ trên kênh này. Bạn có chắc chắn?`}
        confirmLabel="Ngắt kết nối"
        tone="danger"
        isLoading={disconnect.isPending}
        onConfirm={confirmDisconnect}
      />
    </div>
  );
};

export default ChannelsPage;
