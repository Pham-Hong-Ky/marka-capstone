import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AnalyticsFilterBar from '@/components/features/analytics/AnalyticsFilterBar';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import { SkeletonBlock } from '@/components/ui/Skeleton';
import StatCard from '@/components/ui/StatCard';
import { buttonClasses } from '@/components/ui/button.styles';
import { useAnalyticsOverview } from '@/hooks/useAnalytics';
import { useChannels } from '@/hooks/useChannels';
import { useActiveWorkspace } from '@/hooks/useWorkspace';
import type { AnalyticsFilters, AnalyticsOverview, AnalyticsRange } from '@/services/analytics';
import { getErrorMessage } from '@/utils/error';
import { formatNumber } from '@/utils/format';

const RANGE_VALUES: AnalyticsRange[] = ['7d', '30d', 'mtd', 'lastMonth', 'custom'];

const parseRange = (value: string | null): AnalyticsRange =>
  RANGE_VALUES.find((range) => range === value) ?? '7d';

const readFilters = (params: URLSearchParams): AnalyticsFilters => {
  const range = parseRange(params.get('range'));
  const channelId = params.get('channelId') || undefined;
  const tag = params.get('tag') || undefined;

  if (range !== 'custom') {
    return { range, channelId, tag };
  }

  return {
    range,
    from: params.get('from') || undefined,
    to: params.get('to') || undefined,
    channelId,
    tag,
  };
};

const writeFilters = (filters: AnalyticsFilters): URLSearchParams => {
  const params = new URLSearchParams({ range: filters.range });

  if (filters.range === 'custom') {
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
  }

  if (filters.channelId) params.set('channelId', filters.channelId);
  if (filters.tag) params.set('tag', filters.tag);

  return params;
};

export const AnalyticsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeWorkspace = useActiveWorkspace();
  const workspaceId = activeWorkspace?.id ?? null;

  const { data: channelsData } = useChannels(workspaceId);
  const channels = channelsData?.channels ?? [];

  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const isCustomInvalid =
    filters.range === 'custom' && (!filters.from || !filters.to || filters.to < filters.from);

  const overview = useAnalyticsOverview(workspaceId, filters, { enabled: !isCustomInvalid });

  if (!workspaceId) {
    return <EmptyState title="Bạn chưa có workspace nào." />;
  }

  const updateFilters = (next: AnalyticsFilters) => {
    if (next.range === 'custom' && (!next.from || !next.to || next.to < next.from)) {
      return;
    }

    setSearchParams(writeFilters(next), { replace: true });
  };

  const renderContent = (data: AnalyticsOverview) => {
    if (data.coverage.publishedPosts === 0) {
      return (
        <EmptyState
          title="Chưa có bài nào được đăng"
          description="Số liệu sẽ xuất hiện khi bài viết được đăng lên kênh đã kết nối."
          action={
            <Link to="/schedule" className={buttonClasses('outline', 'min-h-11')}>
              Xem lịch xuất bản
            </Link>
          }
        />
      );
    }

    if (data.coverage.syncedPosts === 0) {
      return (
        <EmptyState
          title="Chưa có số liệu"
          description="Bài đã đăng nhưng chưa đồng bộ số liệu từ kênh."
        />
      );
    }

    const { summary } = data;

    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Tương tác"
          value={formatNumber(summary.likes)}
          delta={summary.deltas.likes}
        />
        <StatCard
          label="Bình luận"
          value={formatNumber(summary.comments)}
          delta={summary.deltas.comments}
        />
        <StatCard
          label="Chia sẻ"
          value={formatNumber(summary.shares)}
          delta={summary.deltas.shares}
        />
        <StatCard
          label="Tỷ lệ tương tác"
          value={summary.engagementRate !== null ? `${summary.engagementRate}%` : '—'}
          delta={summary.deltas.engagementRate}
        />
        {summary.impressions !== null ? (
          <StatCard
            label="Hiển thị"
            value={formatNumber(summary.impressions)}
            delta={summary.deltas.impressions}
          />
        ) : null}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Hiệu quả"
        description="Theo dõi tương tác bài đăng trên các kênh đã kết nối."
      />

      <AnalyticsFilterBar
        filters={filters}
        channels={channels}
        tags={overview.data?.tags ?? []}
        onChange={updateFilters}
      />

      {isCustomInvalid ? (
        <Alert variant="danger">Chọn ngày bắt đầu và kết thúc hợp lệ.</Alert>
      ) : null}

      {!isCustomInvalid && overview.isLoading ? <SkeletonBlock /> : null}

      {!isCustomInvalid && overview.isError ? (
        <Alert
          variant="danger"
          title="Không tải được số liệu"
          action={
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => overview.refetch()}
            >
              Thử lại
            </Button>
          }
        >
          {getErrorMessage(overview.error)}
        </Alert>
      ) : null}

      {!isCustomInvalid && !overview.isError && overview.data ? renderContent(overview.data) : null}
    </div>
  );
};

export default AnalyticsPage;
