import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import TextField from '@/components/ui/TextField';
import ImageUploadField from '@/components/ui/ImageUploadField';
import { useAuthStore } from '@/stores/auth.store';
import { useCreateWorkspace, useUploadWorkspaceLogo } from '@/hooks/useWorkspace';
import { workspaceNameFormSchema, type WorkspaceNameFormValues } from '@/services/workspace';

export const CreateWorkspaceModal = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => {
  const setActiveWorkspace = useAuthStore((state) => state.setActiveWorkspace);
  const createWorkspace = useCreateWorkspace();
  const uploadLogo = useUploadWorkspaceLogo();
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<WorkspaceNameFormValues>({
    resolver: zodResolver(workspaceNameFormSchema),
    defaultValues: { name: '' },
  });

  const close = () => {
    reset();
    setLogoFile(null);
    onClose();
  };

  const onSubmit = handleSubmit(({ name }) => {
    createWorkspace.mutate(
      { name },
      {
        onSuccess: (workspace) => {
          setActiveWorkspace(workspace.id);

          if (logoFile) {
            // Workspace đã tạo xong: đóng modal bất kể upload logo thành công hay không.
            uploadLogo.mutate(
              { id: workspace.id, file: logoFile },
              { onSettled: close }
            );
          } else {
            close();
          }
        },
      }
    );
  });

  return (
    <Modal open={open} onClose={close} title="Tạo workspace mới">
      <form id="create-workspace-form" onSubmit={onSubmit} className="space-y-4">
        <TextField
          label="Tên workspace"
          placeholder="Ví dụ: Công ty Truyền thông ABC"
          error={errors.name?.message}
          {...register('name')}
        />

        <ImageUploadField id="create-workspace-logo" label="Logo" onSelect={setLogoFile} />
      </form>

      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={close}>
          Hủy
        </Button>
        <Button
          type="submit"
          form="create-workspace-form"
          isLoading={createWorkspace.isPending || uploadLogo.isPending}
        >
          Tạo workspace
        </Button>
      </div>
    </Modal>
  );
};

export default CreateWorkspaceModal;
