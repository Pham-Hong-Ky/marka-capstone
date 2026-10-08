import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import TextField from '@/components/ui/TextField';
import SelectField from '@/components/ui/SelectField';
import { useInviteMember } from '@/hooks/useWorkspace';
import {
  WORKSPACE_ROLE_LABELS,
  inviteMemberSchema,
  type InviteMemberResult,
  type InviteMemberValues,
} from '@/services/workspace';

export const InviteMemberModal = ({
  open,
  workspaceId,
  onClose,
}: {
  open: boolean;
  workspaceId: string;
  onClose: () => void;
}) => {
  const inviteMember = useInviteMember();
  const [result, setResult] = useState<InviteMemberResult | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteMemberValues>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { email: '', role: 'CONTENT_CREATOR' },
  });

  const close = () => {
    reset();
    setResult(null);
    onClose();
  };

  const onSubmit = handleSubmit(({ email, role }) => {
    inviteMember.mutate(
      { id: workspaceId, payload: { email, role } },
      { onSuccess: (data) => setResult(data) }
    );
  });

  const copyLink = async () => {
    if (!result) return;

    try {
      await navigator.clipboard.writeText(result.inviteUrl);
      toast.success('Đã copy link mời');
    } catch (error) {
      console.error('Không copy được link mời', error);
      toast.error('Không copy được link mời');
    }
  };

  return (
    <Modal open={open} onClose={close} title="Mời thành viên">
      {result ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Đã tạo lời mời cho{' '}
            <span className="font-medium text-foreground">{result.invite.email}</span>. Link mời hết
            hạn sau 7 ngày.
          </p>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 p-2">
            <span className="min-w-0 flex-1 truncate text-xs text-muted">{result.inviteUrl}</span>
            <Button
              type="button"
              variant="outline"
              onClick={copyLink}
              className="shrink-0 px-3 py-1.5 text-xs"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy
            </Button>
          </div>
        </div>
      ) : (
        <form id="invite-member-form" onSubmit={onSubmit} className="space-y-4">
          <TextField
            label="Email"
            type="email"
            placeholder="member@marka.vn"
            error={errors.email?.message}
            {...register('email')}
          />
          <SelectField label="Vai trò" id="invite-role" {...register('role')}>
            <option value="CONTENT_CREATOR">{WORKSPACE_ROLE_LABELS.CONTENT_CREATOR}</option>
            <option value="OWNER">{WORKSPACE_ROLE_LABELS.OWNER}</option>
          </SelectField>
        </form>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={close}>
          {result ? 'Đóng' : 'Hủy'}
        </Button>
        {!result ? (
          <Button type="submit" form="invite-member-form" isLoading={inviteMember.isPending}>
            Gửi lời mời
          </Button>
        ) : null}
      </div>
    </Modal>
  );
};

export default InviteMemberModal;
