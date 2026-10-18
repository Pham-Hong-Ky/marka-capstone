import BrandVoiceForm from '@/components/features/brandvoice/BrandVoiceForm';
import EmptyState from '@/components/ui/EmptyState';
import { useBrandVoice } from '@/hooks/useBrandVoice';
import { useAuthStore } from '@/stores/auth.store';
import { getErrorMessage } from '@/utils/error';

export const BrandVoicePage = () => {
  const user = useAuthStore((state) => state.user);
  const activeWorkspaceId = useAuthStore((state) => state.activeWorkspaceId);
  const activeWorkspace =
    (user?.workspaces ?? []).find((workspace) => workspace.id === activeWorkspaceId) ??
    user?.workspaces[0];
  const workspaceId = activeWorkspace?.id ?? null;
  const canEdit = activeWorkspace?.role === 'OWNER';

  const { data, isLoading, isError, error } = useBrandVoice(workspaceId);

  if (!workspaceId) {
    return (
      <EmptyState
        title="Bạn chưa có workspace nào."
        description="Tạo workspace để thiết lập Brand Voice."
      />
    );
  }

  const hasBrandVoice = Boolean(data?.brandVoice);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Brand Voice</h1>
        <p className="text-sm text-muted">
          Thiết lập tông giọng thương hiệu để nội dung AI tạo ra đúng giọng của workspace.
        </p>
      </div>

      {isLoading ? <p className="text-sm text-muted">Đang tải Brand Voice...</p> : null}

      {isError ? (
        <p className="text-sm text-red-600 dark:text-red-400">{getErrorMessage(error)}</p>
      ) : null}

      {data && !hasBrandVoice && !canEdit ? (
        <EmptyState
          title="Workspace chưa thiết lập Brand Voice."
          description="Chủ sở hữu workspace cần thiết lập tông giọng thương hiệu trước khi dùng cho AI."
        />
      ) : null}

      {data && (hasBrandVoice || canEdit) ? (
        <BrandVoiceForm
          key={workspaceId}
          workspaceId={workspaceId}
          brandVoice={data.brandVoice}
          canEdit={canEdit}
        />
      ) : null}
    </div>
  );
};

export default BrandVoicePage;
