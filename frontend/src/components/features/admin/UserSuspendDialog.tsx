import { useState } from 'react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import TextField from '@/components/ui/TextField';
import { useSuspendUser } from '@/hooks/useAdmin';
import type { AdminUser } from '@/services/admin';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/utils/cn';
import { getErrorMessage } from '@/utils/error';

export const UserSuspendDialog = ({
  user,
  onClose,
}: {
  user: AdminUser | null;
  onClose: () => void;
}) => {
  const suspendUser = useSuspendUser();
  const currentUserId = useAuthStore((state) => state.user?.id ?? null);
  const [reason, setReason] = useState('');

  if (!user) {
    return null;
  }

  const isSelf = user.id === currentUserId;
  const isSuspending = !user.isSuspended;

  const confirm = () => {
    if (isSelf) return;

    suspendUser.mutate(
      { userId: user.id, suspended: isSuspending, reason: reason || undefined },
      { onSuccess: onClose }
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={user.isSuspended ? 'Mở khoá tài khoản?' : 'Khoá tài khoản?'}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={suspendUser.isPending}
            onClick={onClose}
          >
            Huỷ
          </Button>
          <Button
            type="button"
            className={cn('min-h-11', isSuspending && 'bg-danger hover:bg-danger/90')}
            isLoading={suspendUser.isPending}
            disabled={isSelf}
            title={isSelf ? 'Không thể tự khoá tài khoản' : undefined}
            onClick={confirm}
          >
            {isSuspending ? 'Khoá' : 'Mở khoá'}
          </Button>
        </>
      }
    >
      <div>
        <p className="font-medium text-foreground">{user.name}</p>
        <p className="text-sm text-muted">{user.email}</p>
      </div>

      <p className="text-sm text-muted">
        {user.isSuspended
          ? 'Người dùng sẽ có thể đăng nhập và tiếp tục sử dụng hệ thống.'
          : 'Người dùng sẽ không thể đăng nhập cho đến khi được mở khoá.'}
      </p>

      {isSelf ? (
        <Alert variant="warning" title="Không thể tự thay đổi trạng thái">
          Bạn không thể tự khoá hoặc mở khoá tài khoản của chính mình.
        </Alert>
      ) : null}

      {suspendUser.isError ? (
        <Alert variant="danger" title="Không thể cập nhật tài khoản">
          {getErrorMessage(suspendUser.error)}
        </Alert>
      ) : null}

      <div>
        <TextField
          label="Lý do (tuỳ chọn)"
          name="suspend-reason"
          placeholder="Ghi chú lý do để lưu vào audit log"
          maxLength={255}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
        <p className="mt-1 text-xs text-muted">Tối đa 255 ký tự.</p>
      </div>
    </Modal>
  );
};

export default UserSuspendDialog;
