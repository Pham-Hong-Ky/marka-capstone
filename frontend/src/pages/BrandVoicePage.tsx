import BrandVoiceForm from '@/components/features/brandvoice/BrandVoiceForm';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import { useBrandVoice } from '@/hooks/useBrandVoice';
import { getErrorMessage } from '@/utils/error';
import { SkeletonBlock } from '@/components/ui/Skeleton';
import { useActiveWorkspace } from '@/hooks/useWorkspace';

export const BrandVoicePage = () => {
  const activeWorkspace = useActiveWorkspace();
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
      <PageHeader
        title="Brand Voice"
        description="Thiết lập tông giọng thương hiệu để nội dung AI tạo ra đúng giọng của workspace."
      />

      {isLoading ? <SkeletonBlock /> : null}

      {isError ? (
        <p className="text-sm text-danger">{getErrorMessage(error)}</p>
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
