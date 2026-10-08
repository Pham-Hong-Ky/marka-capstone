import { useNavigate } from 'react-router-dom';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useAuthStore } from '@/stores/auth.store';
import { useDeleteWorkspace } from '@/hooks/useWorkspace';

export const DeleteWorkspaceModal = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => {
  const activeWorkspaceId = useAuthStore((state) => state.activeWorkspaceId);
  const activeWorkspace = useAuthStore((state) =>
    (state.user?.workspaces ?? []).find((workspace) => workspace.id === state.activeWorkspaceId)
  );
  const deleteWorkspace = useDeleteWorkspace();
  const navigate = useNavigate();

  const onConfirm = () => {
    if (!activeWorkspaceId) return;

    deleteWorkspace.mutate(activeWorkspaceId, {
      onSuccess: () => {
        onClose();
        navigate('/');
      },
    });
  };

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      tone="danger"
      title="Xóa workspace"
      confirmLabel="Xóa workspace"
      isLoading={deleteWorkspace.isPending}
      onConfirm={onConfirm}
      description={
        <>
          Bạn sắp xóa workspace{' '}
          <span className="font-medium text-foreground">{activeWorkspace?.name}</span>. Hành động này
          không thể hoàn tác.
        </>
      }
    />
  );
};

export default DeleteWorkspaceModal;
