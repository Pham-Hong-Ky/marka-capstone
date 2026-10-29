import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import TextField from '@/components/ui/TextField';
import SelectField from '@/components/ui/SelectField';
import { useInviteMember } from '@/hooks/useWorkspace';
import {
  WORKSPACE_ROLE_OPTIONS,
  inviteMemberSchema,
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
    onClose();
  };

  const onSubmit = handleSubmit(({ email, role }) => {
    inviteMember.mutate(
      { id: workspaceId, payload: { email, role } },
      {
        onSuccess: () => close(),
      }
    );
  });

  return (
    <Modal open={open} onClose={close} title="Mời thành viên">
      <form id="invite-member-form" onSubmit={onSubmit} className="space-y-4">
        <TextField
          label="Email"
          type="email"
          placeholder="member@marka.vn"
          error={errors.email?.message}
          {...register('email')}
        />

        <SelectField label="Vai trò" id="invite-role" {...register('role')}>
          {WORKSPACE_ROLE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>
      </form>

      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={close}>
          Hủy
        </Button>
        <Button type="submit" form="invite-member-form" isLoading={inviteMember.isPending}>
          Gửi lời mời
        </Button>
      </div>
    </Modal>
  );
};

export default InviteMemberModal;
