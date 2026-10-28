import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import SelectableAccountList from '@/components/shared/SelectableAccountList';
import Modal from '@/components/ui/Modal';
import {
  useConnectFacebookPages,
  useFacebookPendingPages,
} from '@/hooks/useChannels';
import { getErrorMessage } from '@/utils/error';
import { SkeletonList } from '@/components/ui/Skeleton';

export const FacebookPagePickerModal = ({
  open,
  workspaceId,
  sessionId,
  onClose,
}: {
  open: boolean;
  workspaceId: string | null;
  sessionId: string | null;
  onClose: () => void;
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { data, isLoading, isError, error } = useFacebookPendingPages(sessionId);
  const connect = useConnectFacebookPages(workspaceId);

  useEffect(() => {
    setSelectedIds([]);
  }, [sessionId, open]);

  const togglePage = (pageId: string) => {
    setSelectedIds((current) =>
      current.includes(pageId) ? current.filter((id) => id !== pageId) : [...current, pageId]
    );
  };

  const handleConnect = () => {
    if (!sessionId || selectedIds.length === 0) return;

    connect.mutate(
      { sessionId, pageIds: selectedIds },
      {
        onSuccess: () => onClose(),
      }
    );
  };

  const pages = data?.pages ?? [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Chọn Page để kết nối"
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
            {selectedIds.length > 0 ? `Kết nối ${selectedIds.length} Page` : 'Kết nối Page'}
          </Button>
        </>
      }
    >
      {isLoading ? <SkeletonList rows={3} /> : null}

      {isError ? (
        <p className="text-sm text-danger">{getErrorMessage(error)}</p>
      ) : null}

      {!isLoading && !isError && pages.length === 0 ? (
        <p className="text-sm text-muted">
          Tài khoản Facebook của bạn chưa có Page nào để kết nối.
        </p>
      ) : null}

      {pages.length > 0 ? (
        <SelectableAccountList
          className="max-h-80 space-y-2 overflow-y-auto"
          accounts={pages}
          selectedIds={selectedIds}
          onToggle={togglePage}
        />
      ) : null}
    </Modal>
  );
};

export default FacebookPagePickerModal;
