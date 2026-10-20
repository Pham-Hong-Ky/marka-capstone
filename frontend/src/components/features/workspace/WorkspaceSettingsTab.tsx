import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Button from '@/components/ui/Button';
import TextField from '@/components/ui/TextField';
import EmptyState from '@/components/ui/EmptyState';
import DefaultWorkspaceIcon from '@/components/shared/DefaultWorkspaceIcon';
import DeleteWorkspaceModal from './DeleteWorkspaceModal';
import { useUpdateWorkspace, useActiveWorkspace } from '@/hooks/useWorkspace';
import { workspaceNameFormSchema, type WorkspaceNameFormValues } from '@/services/workspace';

export const WorkspaceSettingsTab = () => {
  const activeWorkspace = useActiveWorkspace();
  const isOwner = activeWorkspace?.role === 'OWNER';

  const updateWorkspace = useUpdateWorkspace();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<WorkspaceNameFormValues>({
    resolver: zodResolver(workspaceNameFormSchema),
    defaultValues: { name: activeWorkspace?.name ?? '' },
  });

  useEffect(() => {
    reset({ name: activeWorkspace?.name ?? '' });
  }, [activeWorkspace?.id, activeWorkspace?.name, reset]);

  if (!activeWorkspace) {
    return <EmptyState title="Bạn chưa có workspace nào." />;
  }

  const workspaceId = activeWorkspace.id;

  const onSubmit = handleSubmit(({ name }) => {
    if (name === activeWorkspace.name) return;
    updateWorkspace.mutate({ id: workspaceId, data: { name } });
  });

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-sm font-semibold text-foreground">Thông tin workspace</h2>
        <p className="mt-1 text-xs text-muted">
          {isOwner
            ? 'Cập nhật tên hiển thị của workspace.'
            : 'Chỉ chủ sở hữu mới chỉnh sửa được.'}
        </p>

        <div className="mt-4 flex items-center gap-4">
          <DefaultWorkspaceIcon className="h-16 w-16 rounded-xl border border-border" />
          <p className="text-xs text-subtle">Workspace dùng icon mặc định.</p>
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <TextField
            label="Tên workspace"
            disabled={!isOwner}
            error={errors.name?.message}
            {...register('name')}
          />
          {isOwner ? (
            <div className="flex justify-end">
              <Button type="submit" isLoading={updateWorkspace.isPending} disabled={!isDirty}>
                Lưu thay đổi
              </Button>
            </div>
          ) : null}
        </form>
      </section>

      {isOwner ? (
        <section className="rounded-2xl border border-danger/40 bg-danger/5 p-6">
          <h2 className="text-sm font-semibold text-foreground">Vùng nguy hiểm</h2>
          <p className="mt-1 text-xs text-muted">
            Xóa workspace sẽ thu hồi kết nối kênh và ẩn toàn bộ bài viết, media liên quan.
          </p>
          <div className="mt-4">
            <Button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="bg-danger hover:bg-danger/90"
            >
              Xóa workspace
            </Button>
          </div>
        </section>
      ) : null}

      <DeleteWorkspaceModal open={deleteOpen} onClose={() => setDeleteOpen(false)} />
    </div>
  );
};

export default WorkspaceSettingsTab;
