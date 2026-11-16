import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { useSendTesterInvite } from '@/hooks/useAdmin';
import type { AdminUser } from '@/services/admin';
import { getErrorMessage } from '@/utils/error';

export const TesterInviteDialog = ({
  user,
  onClose,
}: {
  user: AdminUser | null;
  onClose: () => void;
}) => {
  const sendInvite = useSendTesterInvite();

  if (!user) {
    return null;
  }

  const confirm = () => {
    sendInvite.mutate(user.id, { onSuccess: onClose });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Gửi email mời Facebook Tester?"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={sendInvite.isPending}
            onClick={onClose}
          >
            Huỷ
          </Button>
          <Button
            type="button"
            className="min-h-11"
            isLoading={sendInvite.isPending}
            onClick={confirm}
          >
            Gửi email
          </Button>
        </>
      }
    >
      <div>
        <p className="font-medium text-foreground">{user.name}</p>
        <p className="text-sm text-muted">{user.email}</p>
      </div>

      <p className="text-sm text-muted">
        Hệ thống sẽ gửi email hướng dẫn để người dùng chấp nhận lời mời làm Tester cho ứng
        dụng Facebook của Marka.
      </p>

      <Alert variant="warning" title="Kiểm tra trước khi gửi">
        Meta không tự thêm tester qua API. Hãy đảm bảo email này đã có trong App Dashboard →
        App Roles → Testers trước khi gửi.
      </Alert>

      {sendInvite.isError ? (
        <Alert variant="danger" title="Không thể gửi email">
          {getErrorMessage(sendInvite.error)}
        </Alert>
      ) : null}
    </Modal>
  );
};

export default TesterInviteDialog;
