import { useEffect, useState } from 'react';
import ChannelPlatformBadge from '@/components/features/channel/ChannelPlatformBadge';
import Alert from '@/components/ui/Alert';
import Badge, { type BadgeVariant } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card, { CardHeader } from '@/components/ui/Card';
import DataTable, { type DataTableColumn } from '@/components/ui/DataTable';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import SelectField from '@/components/ui/SelectField';
import { useAnalyticsPosts } from '@/hooks/useAnalytics';
import {
  ANALYTICS_POST_SORT_OPTIONS,
  type AnalyticsFilters,
  type AnalyticsPostRow,
  type AnalyticsPostSort,
  type AnalyticsSyncStatus,
} from '@/services/analytics';
import { getErrorMessage } from '@/utils/error';
import { formatDateTime, formatNumber } from '@/utils/format';

const PAGE_SIZE = 10;

const SYNC_STATUS_META: Record<AnalyticsSyncStatus, { label: string; variant: BadgeVariant }> = {
  synced: { label: 'Đã đồng bộ', variant: 'success' },
  partial: { label: 'Thiếu lượt xem', variant: 'warning' },
  failed: { label: 'Lỗi đồng bộ', variant: 'danger' },
  pending: { label: 'Chờ đồng bộ', variant: 'neutral' },
};

const engagementOf = (row: AnalyticsPostRow): number => row.reactions + row.comments + row.shares;

const formatOptional = (value: number | null): string =>
  value === null ? '—' : formatNumber(value);

const COLUMNS: DataTableColumn<AnalyticsPostRow>[] = [
  {
    key: 'post',
    header: 'Bài đăng',
    cell: (row) => (
      <div className="min-w-0 max-w-xs">
        <p className="truncate font-medium text-foreground">{row.title}</p>
        <p className="text-[11px] text-muted">
          {row.publishedAt ? formatDateTime(row.publishedAt) : '—'}
        </p>
      </div>
    ),
  },
  {
    key: 'channel',
    header: 'Kênh',
    cell: (row) => (
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <ChannelPlatformBadge platform={row.channel.platform} />
        <span className="truncate text-foreground">{row.channel.name}</span>
      </div>
    ),
  },
  {
    key: 'engagement',
    header: 'Tương tác',
    headerClassName: 'text-right',
    className: 'text-right tabular-nums',
    cell: (row) => (
      <div>
        <p className="font-medium text-foreground">{formatNumber(engagementOf(row))}</p>
        <p className="text-[11px] text-muted">
          {formatNumber(row.reactions)} thích · {formatNumber(row.comments)} bình luận ·{' '}
          {formatNumber(row.shares)} chia sẻ
        </p>
      </div>
    ),
  },
  {
    key: 'impressions',
    header: 'Lượt xem',
    headerClassName: 'text-right',
    className: 'text-right tabular-nums',
    cell: (row) => formatOptional(row.impressions),
  },
  {
    key: 'reach',
    header: 'Tiếp cận',
    headerClassName: 'text-right',
    className: 'text-right tabular-nums',
    hideBelow: 'lg',
    cell: (row) => formatOptional(row.reach),
  },
  {
    key: 'status',
    header: 'Trạng thái',
    cell: (row) => {
      const meta = SYNC_STATUS_META[row.syncStatus];

      return (
        <span title={row.syncError ?? undefined}>
          <Badge variant={meta.variant}>{meta.label}</Badge>
        </span>
      );
    },
  },
];

export const PostMetricsTable = ({
  workspaceId,
  filters,
}: {
  workspaceId: string | null;
  filters: AnalyticsFilters;
}) => {
  const [sort, setSort] = useState<AnalyticsPostSort>('publishedAt');
  const [page, setPage] = useState(1);
  const filterKey = JSON.stringify(filters);

  useEffect(() => {
    setPage(1);
  }, [filterKey, sort]);

  const query = useAnalyticsPosts(workspaceId, { filters, sort, page, limit: PAGE_SIZE });
  const meta = query.data?.meta;

  return (
    <Card>
      <CardHeader
        title="Số liệu theo bài đăng"
        description="Mỗi dòng là một bài đã đăng, kèm kênh và số liệu lấy từ nền tảng"
        action={
          <div className="w-44">
            <SelectField
              id="analytics-post-sort"
              name="sort"
              label="Sắp xếp"
              className="min-h-11"
              value={sort}
              onChange={(event) => setSort(event.target.value as AnalyticsPostSort)}
            >
              {ANALYTICS_POST_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>
          </div>
        }
      />
      <div className="space-y-3 px-4 pb-4">
        <DataTable
          columns={COLUMNS}
          rows={query.data?.posts ?? []}
          getRowKey={(row) => row.id}
          isLoading={query.isLoading}
          error={
            query.isError ? (
              <Alert
                variant="danger"
                title="Không tải được danh sách bài"
                action={
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => void query.refetch()}
                  >
                    Thử lại
                  </Button>
                }
              >
                {getErrorMessage(query.error)}
              </Alert>
            ) : undefined
          }
          empty={
            <EmptyState
              title="Chưa có bài nào được đăng trong khoảng thời gian này."
              description="Thử đổi khoảng thời gian hoặc kênh trong bộ lọc."
            />
          }
        />

        {meta && meta.totalPages > 1 ? (
          <Pagination
            page={meta.page}
            limit={meta.limit}
            total={meta.total}
            totalPages={meta.totalPages}
            onPageChange={setPage}
            itemLabel="bài đăng"
          />
        ) : null}
      </div>
    </Card>
  );
};

export default PostMetricsTable;
