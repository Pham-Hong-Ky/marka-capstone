import { format, parseISO } from 'date-fns';
import { useMemo } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AnalyticsSeriesPoint } from '@/services/analytics';
import { cn } from '@/utils/cn';
import { formatNumber } from '@/utils/format';

const formatDay = (value: string): string => format(parseISO(value), 'dd/MM');

const formatAxisTick = (value: number): string => {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;

    return `${Number(millions.toFixed(1))}M`;
  }

  if (value >= 1000) {
    const thousands = value / 1000;

    return `${thousands < 10 ? Number(thousands.toFixed(1)) : Math.round(thousands)}k`;
  }

  return String(value);
};

const LEGEND_LABELS: Record<string, string> = {
  posts: 'Số bài',
  engagement: 'Tương tác',
};

export const TrendChart = ({
  series,
  className,
}: {
  series: AnalyticsSeriesPoint[];
  className?: string;
}) => {
  const totals = useMemo(
    () =>
      series.reduce(
        (sum, point) => ({
          posts: sum.posts + point.posts,
          engagement: sum.engagement + point.engagement,
        }),
        { posts: 0, engagement: 0 }
      ),
    [series]
  );

  return (
    <section className={cn('rounded-2xl border border-border bg-surface p-5', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground">Chỉ số</h2>
        <p className="text-xs text-muted">Số bài đăng và tương tác theo ngày</p>
      </div>

      <div className="mt-4">
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
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
              yAxisId="posts"
              width={40}
              allowDecimals={false}
              domain={[0, (dataMax: number) => Math.max(dataMax, 4)]}
              tickFormatter={formatAxisTick}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--muted)', fontSize: 12 }}
            />
            <YAxis
              yAxisId="engagement"
              orientation="right"
              width={48}
              allowDecimals={false}
              domain={[0, (dataMax: number) => Math.max(dataMax, 4)]}
              tickFormatter={formatAxisTick}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--muted)', fontSize: 12 }}
            />
            <Tooltip
              cursor={{ stroke: 'var(--border)' }}
              labelFormatter={(label) => formatDay(String(label))}
              formatter={(value, name) => [
                formatNumber(Number(value)),
                LEGEND_LABELS[name ?? ''] ?? name,
              ]}
              contentStyle={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                color: 'var(--foreground)',
              }}
              labelStyle={{ color: 'var(--muted)' }}
              itemStyle={{ color: 'var(--foreground)' }}
            />
            <Legend
              formatter={(value) => LEGEND_LABELS[value] ?? value}
              wrapperStyle={{ color: 'var(--muted)', fontSize: 12, paddingTop: 8 }}
            />
            <Area
              yAxisId="posts"
              type="monotone"
              dataKey="posts"
              name="posts"
              stroke="var(--accent)"
              fill="var(--accent)"
              fillOpacity={0.15}
              strokeWidth={2}
            />
            <Line
              yAxisId="engagement"
              type="monotone"
              dataKey="engagement"
              name="engagement"
              stroke="var(--success)"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="sr-only">
        Trong kỳ có tổng {formatNumber(totals.posts)} bài đăng và{' '}
        {formatNumber(totals.engagement)} lượt tương tác.
      </p>
    </section>
  );
};

export default TrendChart;
