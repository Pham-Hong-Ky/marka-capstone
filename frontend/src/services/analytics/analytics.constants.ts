import type { AnalyticsRange } from './analytics.types';

export const ANALYTICS_RANGE_OPTIONS: Array<{ value: AnalyticsRange; label: string }> = [
  { value: '7d', label: '7 ngày' },
  { value: '30d', label: '30 ngày' },
  { value: 'mtd', label: 'Tháng này' },
  { value: 'lastMonth', label: 'Tháng trước' },
  { value: 'custom', label: 'Tùy chọn' },
];

export const ANALYTICS_RANGES = ANALYTICS_RANGE_OPTIONS.map((option) => option.value);
