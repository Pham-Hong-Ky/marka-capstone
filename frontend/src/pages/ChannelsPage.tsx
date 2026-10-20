import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import ChannelCard from '@/components/features/channel/ChannelCard';
import FacebookPagePickerModal from '@/components/features/channel/FacebookPagePickerModal';
import { useChannels, useDisconnectChannel, useStartFacebookOauth } from '@/hooks/useChannels';
import { FACEBOOK_ERROR_MESSAGES, type ChannelConnection } from '@/services/channel';
import { getErrorMessage } from '@/utils/error';
import { SkeletonList } from '@/components/ui/Skeleton';
import { useActiveWorkspace } from '@/hooks/useWorkspace';

export const ChannelsPage = () => {
  const activeWorkspace = useActiveWorkspace();
  const workspaceId = activeWorkspace?.id ?? null;
  const isOwner = activeWorkspace?.role === 'OWNER';

  const [searchParams, setSearchParams] = useSearchParams();
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [channelToDisconnect, setChannelToDisconnect] = useState<ChannelConnection | null>(null);

  const { data, isLoading, isError, error } = useChannels(workspaceId);
  const startOauth = useStartFacebookOauth();
  const disconnect = useDisconnectChannel(workspaceId);

  useEffect(() => {
    const fb = searchParams.get('fb');
    if (!fb) return;

    if (fb === 'select') {
      const sessionId = searchParams.get('session');
      if (sessionId) setPendingSessionId(sessionId);
    } else if (fb === 'error') {
      const reason = searchParams.get('reason') ?? '';
      toast.error(FACEBOOK_ERROR_MESSAGES[reason] ?? 'Kết nối Facebook thất bại. Vui lòng thử lại.');
    }

    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  if (!workspaceId) {
    return <EmptyState title="Bạn chưa có workspace nào." />;
  }

  const channels = data?.channels ?? [];

  const handleStartOauth = () => startOauth.mutate(workspaceId);

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
        description="Kết nối Facebook Page để chuẩn bị đăng bài và theo dõi hiệu quả nội dung."
        actions={
          isOwner ? (
            <Button
              type="button"
              onClick={handleStartOauth}
              isLoading={startOauth.isPending}
              className="min-h-11"
            >
              <Link2 className="h-4 w-4" />
              Kết nối Facebook
            </Button>
          ) : undefined
        }
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
              ? 'Bấm "Kết nối Facebook" để đăng nhập và chọn Page bạn muốn quản lý.'
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

      <FacebookPagePickerModal
        open={Boolean(pendingSessionId)}
        workspaceId={workspaceId}
        sessionId={pendingSessionId}
        onClose={() => setPendingSessionId(null)}
        onConnected={() => setPendingSessionId(null)}
      />

      <ConfirmDialog
        open={Boolean(channelToDisconnect)}
        onClose={() => setChannelToDisconnect(null)}
        title="Ngắt kết nối kênh?"
        description={`Ngắt kết nối "${channelToDisconnect?.name ?? ''}" sẽ huỷ các bài đăng đang chờ trên kênh này. Bạn có chắc chắn?`}
        confirmLabel="Ngắt kết nối"
        tone="danger"
        isLoading={disconnect.isPending}
        onConfirm={confirmDisconnect}
      />
    </div>
  );
};

export default ChannelsPage;
