import BrandVoiceForm from '@/components/features/brandvoice/BrandVoiceForm';
import BrandVoiceInsightsCard from '@/components/features/brandvoice/BrandVoiceInsightsCard';
import EmptyState from '@/components/ui/EmptyState';
import PageContainer from '@/components/ui/PageContainer';
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
    <PageContainer width="wide">
      <PageHeader
        title="Brand Voice"
        description="Thiết lập tông giọng thương hiệu để nội dung AI tạo ra đúng giọng của workspace."
      />

      {isLoading ? <SkeletonBlock /> : null}

      {isError ? (
        <p className="text-[13px] text-danger">{getErrorMessage(error)}</p>
      ) : null}

      {data && !hasBrandVoice && !canEdit ? (
        <EmptyState
          title="Workspace chưa thiết lập Brand Voice."
          description="Chủ sở hữu workspace cần thiết lập tông giọng thương hiệu trước khi dùng cho AI."
        />
      ) : null}

      {data && (hasBrandVoice || canEdit) ? (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="order-2 min-w-0 lg:order-1">
            <BrandVoiceForm
              key={workspaceId}
              workspaceId={workspaceId}
              brandVoice={data.brandVoice}
              canEdit={canEdit}
            />
          </div>
          <div className="order-1 lg:sticky lg:top-20 lg:order-2">
            <BrandVoiceInsightsCard
              key={workspaceId}
              workspaceId={workspaceId}
              brandVoice={data.brandVoice}
              canEdit={canEdit}
            />
          </div>
        </div>
      ) : null}
    </PageContainer>
  );
};

export default BrandVoicePage;
