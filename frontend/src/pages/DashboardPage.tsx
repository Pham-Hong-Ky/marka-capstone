import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useAnalyticsOverview, useAnalyticsSuggestions } from '@/hooks/useAnalytics';
import { useAnalyticsSync } from '@/hooks/useAnalyticsSync';
import { useChannels } from '@/hooks/useChannels';
import { usePosts } from '@/hooks/usePost';
import { useActiveWorkspace } from '@/hooks/useWorkspace';
import {
  ANALYTICS_RANGES,
  type AnalyticsFilters,
  type AnalyticsRange,
} from '@/services/analytics';
import { getErrorMessage } from '@/utils/error';
import { formatNumber } from '@/utils/format';

const parseRange = (value: string | null): AnalyticsRange =>
  ANALYTICS_RANGES.find((range) => range === value) ?? '7d';

const readFilters = (params: URLSearchParams): AnalyticsFilters => {
  const range = parseRange(params.get('range'));
  const channelId = params.get('channelId') || undefined;

  if (range !== 'custom') {
    return { range, channelId };
  }

  return {
    range,
    from: params.get('from') || undefined,
    to: params.get('to') || undefined,
    channelId,
  };
};

const isCustomRangeInvalid = (filters: AnalyticsFilters): boolean =>
  filters.range === 'custom' && (!filters.from || !filters.to || filters.to < filters.from);

const writeFilters =(filters: AnalyticsFilters): URLSearchParams => {
  const params = new URLSearchParams({ range: filters.range });

  if (filters.range === 'custom') {
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
  }

  if (filters.channelId) params.set('channelId', filters.channelId);

  return params;
};

export const DashboardPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeWorkspace = useActiveWorkspace();
  const workspaceId = activeWorkspace?.id ?? null;

  const posts = usePosts(workspaceId, { page: 1, limit: 1 });
  const { data: channelsData } = useChannels(workspaceId);
  const channels = channelsData?.channels ?? [];

  const filters = useMemo(() => readFilters(searchParams), [searchParams]);

  const updateFilters = useCallback(
    (next: AnalyticsFilters) => {
      if (isCustomRangeInvalid(next)) return;
      setSearchParams(writeFilters(next), { replace: true });
    },
    [setSearchParams]
  );

  // Kênh không thuộc danh sách đã tải (đổi workspace, URL cũ) bị loại khỏi truy vấn ngay,
  // rồi effect bên dưới xoá luôn khỏi URL.
  const channelsLoaded = channelsData !== undefined;
  const channelExists = filters.channelId
    ? channelsLoaded && channels.some((channel) => channel.id === filters.channelId)
    : true;
  const effectiveFilters = useMemo(
    () => (channelExists ? filters : { ...filters, channelId: undefined }),
    [channelExists, filters]
  );

  const isCustomInvalid = isCustomRangeInvalid(filters);

  const syncKey = [
    workspaceId,
    effectiveFilters.range,
    effectiveFilters.from ?? '',
    effectiveFilters.to ?? '',
    effectiveFilters.channelId ?? '',
  ].join('|');

  const [pollInterval, setPollInterval] = useState<number | false>(false);
  const overview = useAnalyticsOverview(workspaceId, effectiveFilters, {
    enabled: !isCustomInvalid,
    refetchInterval: pollInterval,
  });
  const { start, isWaiting, error: syncError } = useAnalyticsSync({
    workspaceId,
    coverage: overview.data?.coverage,
    syncKey,
  });
  const suggestions = useAnalyticsSuggestions(workspaceId, effectiveFilters.channelId);

  useEffect(() => {
    if (!filters.channelId || !channelsLoaded || channelExists) {
      return;
    }

    updateFilters({ ...filters, channelId: undefined });
  }, [channelsLoaded, channelExists, filters, updateFilters]);

  useEffect(() => {
    setPollInterval(isWaiting ? 5000 : false);
  }, [isWaiting]);

  if (!workspaceId) {
    return (
      <EmptyState
        title="Bạn chưa có workspace nào."
        description="Tạo workspace để bắt đầu soạn nội dung."
      />
    );
  }

  const coverage = overview.data?.coverage;
  const summary = overview.data?.summary;
  const hasSyncedMetrics = (coverage?.syncedPosts ?? 0) > 0;
  const engagement = summary ? summary.likes + summary.comments + summary.shares : null;
  const reach = summary?.reach ?? null;

  const syncButton = (
    <Button
      type="button"
      variant="outline"
      className="min-h-11"
      isLoading={isWaiting}
      disabled={!overview.data || coverage?.publishedPosts === 0}
      onClick={start}
    >
      <RefreshCw className="h-4 w-4" />
      Đồng bộ số liệu
    </Button>
  );

  const showSuggestions = !isCustomInvalid && !overview.isError && (coverage?.publishedPosts ?? 0) > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Tổng quan"
        description="Theo dõi hiệu quả nội dung và tương tác trên các kênh đã kết nối."
        actions={syncButton}
      />

      <AnalyticsFilterBar
        filters={effectiveFilters}
        channels={channels}
        onChange={updateFilters}
      />

      {isCustomInvalid ? (
        <Alert variant="danger">Chọn ngày bắt đầu và kết thúc hợp lệ.</Alert>
      ) : null}

      {syncError ? (
        <Alert variant="danger" title="Không đồng bộ được số liệu">
          {getErrorMessage(syncError)}
        </Alert>
      ) : null}

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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Bài viết" value={posts.data ? formatNumber(posts.data.meta.total) : '—'} />
        <StatCard
          label="Kênh đã kết nối"
          value={channelsData ? formatNumber(channels.length) : '—'}
        />
        <StatCard
          label="Tương tác"
          value={hasSyncedMetrics && engagement !== null ? formatNumber(engagement) : '—'}
        />
        <StatCard
          label="Lượt tiếp cận"
          value={hasSyncedMetrics && reach !== null ? formatNumber(reach) : '—'}
        />
        <StatCard
          label="Credit còn lại"
          value={formatNumber(activeWorkspace?.remainingCredit ?? 0)}
        />
      </div>

      {!isCustomInvalid && !overview.isError ? (
        <div className="space-y-4">
          {overview.isLoading && !overview.data ? <SkeletonBlock /> : null}

          {overview.data ? (
            <>
              <CoverageAlert coverage={overview.data.coverage} />
              <TrendChart series={overview.data.series} />

              {overview.data.coverage.publishedPosts === 0 ? (
                <p className="text-sm text-muted">
                  Chưa có bài viết nào được đăng trong khoảng thời gian này.{' '}
                  <Link to="/schedule" className="text-accent-text hover:underline">
                    Xem lịch xuất bản
                  </Link>
                </p>
              ) : overview.data.coverage.syncedPosts === 0 ? (
                <p className="text-sm text-muted">
                  Chưa có số liệu từ kênh. Bấm <span className="font-medium">Đồng bộ số liệu</span>{' '}
                  để lấy dữ liệu mới nhất.
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {showSuggestions ? (
        <div className="space-y-4">
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

export default DashboardPage;
