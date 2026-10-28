import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import SelectableAccountList from '@/components/shared/SelectableAccountList';
import Modal from '@/components/ui/Modal';
import { useConnectAccounts, usePendingAccounts } from '@/hooks/useChannels';
import { getChannelPlatformMeta, type ChannelPlatform } from '@/services/channel';
import { getErrorMessage } from '@/utils/error';
import { SkeletonList } from '@/components/ui/Skeleton';

export const ChannelAccountPickerModal = ({
  open,
  platform,
  workspaceId,
  sessionId,
  onClose,
}: {
  open: boolean;
  platform: ChannelPlatform;
  workspaceId: string | null;
  sessionId: string | null;
  onClose: () => void;
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { data, isLoading, isError, error } = usePendingAccounts(platform, sessionId);
  const connect = useConnectAccounts(workspaceId, platform);
  const meta = getChannelPlatformMeta(platform);
  const accountLabel = platform === 'FACEBOOK' ? 'Page' : 'tài khoản';

  useEffect(() => {
    setSelectedIds([]);
  }, [sessionId, open]);

  const toggleAccount = (accountId: string) => {
    setSelectedIds((current) =>
      current.includes(accountId)
        ? current.filter((id) => id !== accountId)
        : [...current, accountId]
    );
  };

  const handleConnect = () => {
    if (!sessionId || selectedIds.length === 0) return;

    connect.mutate(
      { sessionId, accountIds: selectedIds },
      {
        onSuccess: () => onClose(),
      }
    );
  };

  const accounts = (data?.accounts ?? []).map((account) => ({
    id: account.externalAccountId,
    name: account.name,
    avatar: account.avatar,
  }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Chọn ${accountLabel} để kết nối`}
      className="max-w-lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={connect.isPending}>
            Hủy
          </Button>
          <Button
            type="button"
            onClick={handleConnect}
            isLoading={connect.isPending}
            disabled={selectedIds.length === 0 || isLoading}
          >
            {selectedIds.length > 0
              ? `Kết nối ${selectedIds.length} ${accountLabel}`
              : `Kết nối ${accountLabel}`}
          </Button>
        </>
      }
    >
      {isLoading ? <SkeletonList rows={3} /> : null}

      {isError ? (
        <p className="text-sm text-danger">{getErrorMessage(error)}</p>
      ) : null}

      {!isLoading && !isError && accounts.length === 0 ? (
        <p className="text-sm text-muted">
          Tài khoản {meta.label} của bạn chưa có {accountLabel} nào để kết nối.
        </p>
      ) : null}

      {accounts.length > 0 ? (
        <SelectableAccountList
          className="max-h-80 space-y-2 overflow-y-auto"
          accounts={accounts}
          selectedIds={selectedIds}
          onToggle={toggleAccount}
        />
      ) : null}
    </Modal>
  );
};

export default ChannelAccountPickerModal;
