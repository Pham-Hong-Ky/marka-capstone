import StatCard from '@/components/ui/StatCard';
import type { ChannelStats } from '@/services/channel';
import { formatDateTime, formatNumber } from '@/utils/format';

export const ChannelStatsGrid = ({
  stats,
  showMetrics,
}: {
  stats: ChannelStats;
  showMetrics: boolean;
}) => {
  const engagementMetrics = [
    { label: 'Tương tác', value: stats.reactions },
    { label: 'Bình luận', value: stats.comments },
    { label: 'Chia sẻ', value: stats.shares },
  ];
  const reachMetrics = [
    { label: 'Hiển thị', value: stats.impressions },
    { label: 'Lượt tiếp cận', value: stats.reach },
  ].filter((metric) => metric.value > 0);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Bài đã đăng" value={formatNumber(stats.publishedPosts)} className="p-4" />

        {showMetrics
          ? [...engagementMetrics, ...reachMetrics].map((metric) => (
              <StatCard
                key={metric.label}
                label={metric.label}
                value={formatNumber(metric.value)}
                className="p-4"
              />
            ))
          : null}
      </div>

      {showMetrics ? null : (
        <p className="text-sm text-muted">Nền tảng này chưa cung cấp số liệu tương tác.</p>
      )}

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-subtle">
        <p>
          {stats.lastSyncedAt
            ? `Đồng bộ lần cuối ${formatDateTime(stats.lastSyncedAt)}`
            : 'Chưa có số liệu đồng bộ.'}
        </p>
        {stats.lastPublishedAt ? (
          <p>Bài đăng gần nhất {formatDateTime(stats.lastPublishedAt)}</p>
        ) : null}
      </div>
    </div>
  );
};

export default ChannelStatsGrid;
