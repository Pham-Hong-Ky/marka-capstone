import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import AnalyticsFilterBar from '@/components/features/analytics/AnalyticsFilterBar';
import BestTimesCard from '@/components/features/analytics/BestTimesCard';
import ContentTipsCard from '@/components/features/analytics/ContentTipsCard';
import CoverageAlert from '@/components/features/analytics/CoverageAlert';
import TrendChart from '@/components/features/analytics/TrendChart';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import { SkeletonBlock } from '@/components/ui/Skeleton';
import StatCard from '@/components/ui/StatCard';
import { buttonClasses } from '@/components/ui/button.styles';
import { useAnalyticsOverview, useAnalyticsSuggestions } from '@/hooks/useAnalytics';
import { useAnalyticsSync } from '@/hooks/useAnalyticsSync';
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

  const [pollInterval, setPollInterval] = useState<number | false>(false);
  const overview = useAnalyticsOverview(workspaceId, filters, {
    enabled: !isCustomInvalid,
    refetchInterval: pollInterval,
  });
  const { start, isWaiting, error: syncError } = useAnalyticsSync({
    workspaceId,
    coverage: overview.data?.coverage,
  });
  const suggestions = useAnalyticsSuggestions(workspaceId, filters.channelId);

  useEffect(() => {
    setPollInterval(isWaiting ? 5000 : false);
  }, [isWaiting]);

  if (!workspaceId) {
    return <EmptyState title="Bạn chưa có workspace nào." />;
  }

  const syncButton = (
    <Button
      type="button"
      variant="outline"
      className="min-h-11"
      isLoading={isWaiting}
      disabled={!workspaceId || overview.data?.coverage.publishedPosts === 0}
      onClick={start}
    >
      <RefreshCw className="h-4 w-4" />
      Đồng bộ số liệu
    </Button>
  );

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
          action={syncButton}
        />
      );
    }

    const { summary } = data;

    return (
      <div className="space-y-6">
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

        {data.coverage.publishedPosts > 0 ? (
          <div className="space-y-4">
            <CoverageAlert coverage={data.coverage} />
            <TrendChart series={data.series} />
          </div>
        ) : null}
      </div>
    );
  };

  const showSuggestions =
    !isCustomInvalid && !overview.isError && (overview.data?.coverage.publishedPosts ?? 0) > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Hiệu quả"
        description="Theo dõi tương tác bài đăng trên các kênh đã kết nối."
        actions={syncButton}
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

      {showSuggestions ? (
        <div className="space-y-4">
          {syncError ? (
            <Alert variant="danger" title="Không đồng bộ được số liệu">
              {getErrorMessage(syncError)}
            </Alert>
          ) : null}

          {suggestions.isFetching && !suggestions.data ? <SkeletonBlock /> : null}

          {suggestions.isError ? (
            <Alert
              variant="danger"
              title="Không tải được gợi ý"
              action={
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  onClick={() => suggestions.refetch()}
                >
                  Thử lại
                </Button>
              }
            >
              {getErrorMessage(suggestions.error)}
            </Alert>
          ) : null}

          {suggestions.data ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <BestTimesCard suggestions={suggestions.data} />
              <ContentTipsCard suggestions={suggestions.data} />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default AnalyticsPage;
