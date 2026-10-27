import { format, parseISO } from 'date-fns';
import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import SegmentedControl, { type SegmentedOption } from '@/components/ui/SegmentedControl';
import type { AnalyticsSeriesPoint } from '@/services/analytics';
import { cn } from '@/utils/cn';
import { formatNumber } from '@/utils/format';

export type TrendMetric = 'reach' | 'impressions' | 'posts';

const METRIC_OPTIONS: SegmentedOption<TrendMetric>[] = [
  { value: 'reach', label: 'Lượt tiếp cận' },
  { value: 'impressions', label: 'Hiển thị' },
  { value: 'posts', label: 'Số bài' },
];

const METRIC_LABELS: Record<TrendMetric, string> = {
  reach: 'Lượt tiếp cận',
  impressions: 'Hiển thị',
  posts: 'Số bài',
};

const formatDay = (value: string): string => format(parseISO(value), 'dd/MM');

export const TrendChart = ({
  series,
  className,
}: {
  series: AnalyticsSeriesPoint[];
  className?: string;
}) => {
  const [metric, setMetric] = useState<TrendMetric>('reach');

  const totals = useMemo(
    () =>
      series.reduce(
        (sum, point) => ({
          posts: sum.posts + point.posts,
          reach: sum.reach + point.reach,
          impressions: sum.impressions + point.impressions,
        }),
        { posts: 0, reach: 0, impressions: 0 }
      ),
    [series]
  );

  return (
    <section className={cn('rounded-2xl border border-border bg-surface p-5', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-semibold text-foreground">Xu hướng</h2>
        <SegmentedControl
          options={METRIC_OPTIONS}
          value={metric}
          onChange={setMetric}
          ariaLabel="Chọn chỉ số hiển thị trên biểu đồ"
        />
      </div>

      <div className="mt-4">
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDay}
              tickLine={false}
              axisLine={false}
              minTickGap={16}
              tick={{ fill: 'var(--muted)', fontSize: 12 }}
            />
            <YAxis
              width={40}
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--muted)', fontSize: 12 }}
            />
            <Tooltip
              cursor={{ stroke: 'var(--border)' }}
              labelFormatter={(label) => formatDay(String(label))}
              formatter={(value) => [formatNumber(Number(value)), METRIC_LABELS[metric]]}
              contentStyle={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                color: 'var(--foreground)',
              }}
              labelStyle={{ color: 'var(--muted)' }}
              itemStyle={{ color: 'var(--foreground)' }}
            />
            <Area
              type="monotone"
              dataKey={metric}
              stroke="var(--accent)"
              fill="var(--accent)"
              fillOpacity={0.15}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <p className="sr-only">
        Trong kỳ có tổng {formatNumber(totals.posts)} bài, {formatNumber(totals.reach)} lượt tiếp cận và{' '}
        {formatNumber(totals.impressions)} lượt hiển thị.
      </p>
    </section>
  );
};

export default TrendChart;
