import AdminStatusBreakdown from '@/components/features/admin/AdminStatusBreakdown';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import { SkeletonBlock } from '@/components/ui/Skeleton';
import StatCard from '@/components/ui/StatCard';
import { useAdminStats } from '@/hooks/useAdmin';
import { getErrorMessage } from '@/utils/error';
import { formatNumber } from '@/utils/format';

export const AdminOverviewPage = () => {
  const { data, isLoading, isError, isFetching, error, refetch } = useAdminStats();

  if (isLoading) {
    return <SkeletonBlock />;
  }

  if (isError) {
    return (
      <Alert
        variant="danger"
        title="Không tải được số liệu tổng quan"
        action={
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            isLoading={isFetching}
            onClick={() => void refetch()}
          >
            Thử lại
          </Button>
        }
      >
        {getErrorMessage(error)}
      </Alert>
    );
  }

  if (!data) {
    return null;
  }

  const { users, workspaces, posts, channels, billing } = data;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Người dùng"
          value={formatNumber(users.total)}
          hint={`${formatNumber(users.active)} hoạt động · ${formatNumber(users.suspended)} bị khoá`}
        />
        <StatCard
          label="Admin"
          value={formatNumber(users.admins)}
          hint={`${formatNumber(users.createdLast30Days)} mới trong 30 ngày`}
        />
        <StatCard
          label="Workspace"
          value={formatNumber(workspaces.total)}
          hint={`${formatNumber(workspaces.createdLast30Days)} mới trong 30 ngày`}
        />
        <StatCard label="Bài viết" value={formatNumber(posts.total)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Kênh hoạt động" value={formatNumber(channels.ACTIVE)} />
        <StatCard label="Kênh hết hạn" value={formatNumber(channels.EXPIRED)} />
        <StatCard label="Đơn PAID 30 ngày" value={formatNumber(billing.paidOrdersLast30Days)} />
        <StatCard
          label="Doanh thu 30 ngày"
          value={`${formatNumber(billing.revenueLast30Days)} đ`}
        />
      </div>

      <AdminStatusBreakdown byStatus={posts.byStatus} />
    </div>
  );
};

export default AdminOverviewPage;
