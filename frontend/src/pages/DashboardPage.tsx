import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { RefreshCw, Share2 } from 'lucide-react';
import AnalyticsFilterBar from '@/components/features/analytics/AnalyticsFilterBar';
import BestTimesCard from '@/components/features/analytics/BestTimesCard';
import ContentTipsCard from '@/components/features/analytics/ContentTipsCard';
import CoverageAlert from '@/components/features/analytics/CoverageAlert';
import ChannelPlatformBadge from '@/components/features/channel/ChannelPlatformBadge';
import ChannelStatusBadge from '@/components/features/channel/ChannelStatusBadge';
import Alert from '@/components/ui/Alert';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Card, { CardBody, CardHeader } from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import MetricStrip from '@/components/ui/MetricStrip';
import PageContainer from '@/components/ui/PageContainer';
import PageHeader from '@/components/ui/PageHeader';
import { Skeleton, SkeletonBlock } from '@/components/ui/Skeleton';
import { buttonClasses } from '@/components/ui/button.styles';
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
import type { ChannelConnection } from '@/services/channel';
import { getErrorMessage } from '@/utils/error';
import { formatNumber } from '@/utils/format';

// Tách recharts (~400KB) khỏi bundle trang mặc định.
const TrendChart = lazy(() => import('@/components/features/analytics/TrendChart'));

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

const writeFilters = (filters: AnalyticsFilters): URLSearchParams => {
  const params = new URLSearchParams({ range: filters.range });

  if (filters.range === 'custom') {
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
  }

  if (filters.channelId) params.set('channelId', filters.channelId);

  return params;
};

const ChannelOverview = ({
  channels,
  isLoading,
  isError,
  onRetry,
}: {
  channels: ChannelConnection[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) => (
  <Card className="flex flex-col">
    <CardHeader
      title="Kênh đã kết nối"
      description="Trạng thái kết nối hiện tại"
      action={
        <Link to="/channels" className="text-[11px] font-semibold text-accent-text hover:underline">
          Quản lý
        </Link>
      }
    />

    <CardBody className="flex-1">
      {isError ? (
        <div className="space-y-2">
          <p className="text-[13px] text-danger">Không tải được danh sách kênh.</p>
          <Button type="button" variant="outline" className="min-h-11" onClick={onRetry}>
            Thử lại
          </Button>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-2.5 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : channels.length === 0 ? (
        <EmptyState
          icon={Share2}
          title="Chưa có kênh nào"
          description="Kết nối kênh để bắt đầu đăng bài và theo dõi hiệu quả."
          action={
            <Link to="/channels" className={buttonClasses('outline', 'min-h-11')}>
              Kết nối kênh
            </Link>
          }
          className="border-0 px-0 py-8"
        />
      ) : (
        <div className="divide-y divide-border">
          {channels.map((channel) => (
            <div key={channel.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <Avatar
                name={channel.label ?? channel.name}
                src={channel.avatar}
                className="h-8 w-8"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-foreground">
                  {channel.label ?? channel.name}
                </p>
                <p className="truncate text-[11px] text-muted">{channel.name}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <ChannelPlatformBadge platform={channel.platform} />
                <ChannelStatusBadge status={channel.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </CardBody>
  </Card>
);

export const DashboardPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeWorkspace = useActiveWorkspace();
  const workspaceId = activeWorkspace?.id ?? null;

  const posts = usePosts(workspaceId, { page: 1, limit: 1 });
  const {
    data: channelsData,
    isLoading: channelsLoading,
    isError: channelsError,
    refetch: refetchChannels,
  } = useChannels(workspaceId);
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

  const metrics = [
    {
      label: 'Bài viết',
      value: posts.data ? formatNumber(posts.data.meta.total) : '—',
    },
    {
      label: 'Kênh đã kết nối',
      value: channelsData ? formatNumber(channels.length) : '—',
    },
    {
      label: 'Tương tác',
      value: hasSyncedMetrics && engagement !== null ? formatNumber(engagement) : '—',
    },
    {
      label: 'Lượt tiếp cận',
      value: hasSyncedMetrics && reach !== null ? formatNumber(reach) : '—',
    },
    {
      label: 'Credit còn lại',
      value: formatNumber(activeWorkspace?.remainingCredit ?? 0),
    },
  ];

  return (
    <PageContainer width="wide">
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

      <MetricStrip items={metrics} />

      {!isCustomInvalid && !overview.isError ? (
        <div className="space-y-3">
          {overview.isLoading && !overview.data ? <SkeletonBlock /> : null}

          {overview.data ? (
            <>
              <CoverageAlert coverage={overview.data.coverage} />

              <div className="grid gap-3 lg:grid-cols-[1.6fr_1fr]">
                <Suspense fallback={<SkeletonBlock className="h-72" />}>
                  <TrendChart series={overview.data.series} />
                </Suspense>
                <ChannelOverview
                  channels={channels}
                  isLoading={channelsLoading}
                  isError={channelsError}
                  onRetry={() => void refetchChannels()}
                />
              </div>

              {overview.data.coverage.publishedPosts === 0 ? (
                <p className="text-[13px] text-muted">
                  Chưa có bài viết nào được đăng trong khoảng thời gian này.{' '}
                  <Link to="/schedule" className="text-accent-text hover:underline">
                    Xem lịch xuất bản
                  </Link>
                </p>
              ) : overview.data.coverage.syncedPosts === 0 ? (
                <p className="text-[13px] text-muted">
                  Chưa có số liệu từ kênh. Bấm <span className="font-medium">Đồng bộ số liệu</span>{' '}
                  để lấy dữ liệu mới nhất.
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {showSuggestions ? (
        <div className="space-y-3">
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
            <div className="grid gap-3 lg:grid-cols-2">
              <BestTimesCard suggestions={suggestions.data} />
              <ContentTipsCard suggestions={suggestions.data} />
            </div>
          ) : null}
        </div>
      ) : null}
    </PageContainer>
  );
};

export default DashboardPage;
