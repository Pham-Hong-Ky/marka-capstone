import { useState } from 'react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import SelectField from '@/components/ui/SelectField';
import { useSendTesterInvite } from '@/hooks/useAdmin';
import type { AdminUser, TesterInvitePlatform } from '@/services/admin';
import { getErrorMessage } from '@/utils/error';

const PLATFORM_COPY: Record<
  TesterInvitePlatform,
  { label: string; description: string; warning: string }
> = {
  FACEBOOK: {
    label: 'Facebook',
    description:
      'Hệ thống sẽ gửi email hướng dẫn để người dùng chấp nhận lời mời làm Tester cho ứng dụng Facebook của Marka.',
    warning:
      'Meta không tự thêm tester qua API. Hãy đảm bảo email này đã có trong App Dashboard → App Roles → Testers trước khi gửi.',
  },
  THREADS: {
    label: 'Threads',
    description:
      'Hệ thống sẽ gửi email hướng dẫn để người dùng chấp nhận lời mời làm Tester cho ứng dụng Threads của Marka.',
    warning:
      'Meta không tự thêm tester qua API. Hãy thêm tên người dùng Threads (username, không phải email) vào App Dashboard → App Roles → Threads Tester trước khi gửi.',
  },
};

export const TesterInviteDialog = ({
  user,
  onClose,
}: {
  user: AdminUser | null;
  onClose: () => void;
}) => {
  const [platform, setPlatform] = useState<TesterInvitePlatform>('FACEBOOK');
  const sendInvite = useSendTesterInvite();

  if (!user) {
    return null;
  }

  const copy = PLATFORM_COPY[platform];

  const confirm = () => {
    sendInvite.mutate({ userId: user.id, platform }, { onSuccess: onClose });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Gửi email mời Tester?"
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

      <SelectField
        label="Nền tảng"
        name="tester-platform"
        value={platform}
        disabled={sendInvite.isPending}
        onChange={(event) => setPlatform(event.target.value as TesterInvitePlatform)}
      >
        {Object.entries(PLATFORM_COPY).map(([value, item]) => (
          <option key={value} value={value}>
            {item.label}
          </option>
        ))}
      </SelectField>

      <p className="text-sm text-muted">{copy.description}</p>

      <Alert variant="warning" title="Kiểm tra trước khi gửi">
        {copy.warning}
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
