import { useState } from 'react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useLogoutAll } from '@/hooks/useAccount';
import { getErrorMessage } from '@/utils/error';

export const SessionSecurityCard = () => {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const logoutAll = useLogoutAll();

  const onConfirm = () => {
    logoutAll.mutate(undefined, { onSettled: () => setConfirmOpen(false) });
  };

  return (
    <section className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="text-sm font-semibold text-foreground">Phiên đăng nhập</h2>
      <p className="mt-1 text-xs text-muted">
        Đăng xuất khỏi tất cả thiết bị. Bạn sẽ cần đăng nhập lại.
      </p>

      {logoutAll.error ? (
        <div className="mt-4">
          <Alert variant="danger">{getErrorMessage(logoutAll.error)}</Alert>
        </div>
      ) : null}

      <div className="mt-6 flex justify-end">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          isLoading={logoutAll.isPending}
          onClick={() => setConfirmOpen(true)}
        >
          Đăng xuất mọi thiết bị
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Đăng xuất mọi thiết bị"
        description="Tất cả phiên đăng nhập, kể cả thiết bị này, sẽ kết thúc ngay lập tức."
        confirmLabel="Đăng xuất tất cả"
        tone="danger"
        isLoading={logoutAll.isPending}
        onConfirm={onConfirm}
      />
    </section>
  );
};

export default SessionSecurityCard;
