import { useEffect, useState } from 'react';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
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
  onConnected,
}: {
  open: boolean;
  workspaceId: string | null;
  sessionId: string | null;
  onClose: () => void;
  onConnected: () => void;
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
        onSuccess: () => {
          onConnected();
          onClose();
        },
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
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {pages.map((page) => (
            <label
              key={page.id}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border p-3 transition hover:bg-surface-2"
            >
              <input
                type="checkbox"
                className="h-4 w-4 accent-accent"
                checked={selectedIds.includes(page.id)}
                onChange={() => togglePage(page.id)}
              />
              <Avatar name={page.name} src={page.avatar} className="h-9 w-9" />
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">{page.name}</span>
            </label>
          ))}
        </div>
      ) : null}
    </Modal>
  );
};

export default FacebookPagePickerModal;
