import { BadRequestError } from '../../utils/errors/index.js';

export const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RANGE_DAYS = 366;

export type AnalyticsRange = '7d' | '30d' | 'mtd' | 'lastMonth' | 'custom';

export interface MetricRow {
  publishedAt: Date;
  reactions: number;
  comments: number;
  shares: number;
  impressions: number | null;
  reach: number | null;
}

export interface Summary {
  likes: number;
  comments: number;
  shares: number;
  impressions: number | null;
  engagementRate: number | null;
}

export interface SeriesPoint {
  date: string;
  posts: number;
  reach: number;
  impressions: number;
}

export interface DateWindow {
  start: Date;
  end: Date;
}

const round = (value: number, digits: number): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

export const startOfVnDay = (date: Date): Date => {
  const shifted = date.getTime() + VN_OFFSET_MS;
  return new Date(Math.floor(shifted / DAY_MS) * DAY_MS - VN_OFFSET_MS);
};

export const startOfVnMonth = (date: Date): Date => {
  const shifted = new Date(date.getTime() + VN_OFFSET_MS);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1) - VN_OFFSET_MS);
};

const addDays = (date: Date, days: number): Date => new Date(date.getTime() + days * DAY_MS);

const endOfVnDay = (date: Date): Date =>
  new Date(startOfVnDay(date).getTime() + DAY_MS - 1);

const vnDateKey = (date: Date): string =>
  new Date(date.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);

export const resolveRange = (
  range: AnalyticsRange,
  from: Date | undefined,
  to: Date | undefined,
  now: Date = new Date()
): { current: DateWindow; previous: DateWindow } => {
  let current: DateWindow;

  switch (range) {
    case '7d':
      current = { start: addDays(startOfVnDay(now), -6), end: now };
      break;
    case '30d':
      current = { start: addDays(startOfVnDay(now), -29), end: now };
      break;
    case 'mtd':
      current = { start: startOfVnMonth(now), end: now };
      break;
    case 'lastMonth': {
      const currentMonthStart = startOfVnMonth(now);
      const start = startOfVnMonth(new Date(currentMonthStart.getTime() - 1));
      current = { start, end: new Date(currentMonthStart.getTime() - 1) };
      break;
    }
    case 'custom': {
      if (!from || !to) {
        throw new BadRequestError('Cần chọn ngày bắt đầu và ngày kết thúc');
      }
      current = { start: startOfVnDay(from), end: endOfVnDay(to) };
      break;
    }
    default:
      throw new BadRequestError('Khoảng thời gian không hợp lệ');
  }

  const spanMs = current.end.getTime() - current.start.getTime() + 1;

  if (spanMs > MAX_RANGE_DAYS * DAY_MS) {
    throw new BadRequestError('Khoảng thời gian tối đa 366 ngày');
  }

  return {
    current,
    previous: {
      start: new Date(current.start.getTime() - spanMs),
      end: new Date(current.start.getTime() - 1),
    },
  };
};

export const computeSummary = (rows: MetricRow[]): Summary => {
  let likes = 0;
  let comments = 0;
  let shares = 0;
  let impressionsTotal = 0;
  let reachTotal = 0;
  let hasImpressions = false;
  let hasReach = false;

  for (const row of rows) {
    likes += row.reactions;
    comments += row.comments;
    shares += row.shares;

    if (row.impressions !== null) {
      impressionsTotal += row.impressions;
      hasImpressions = true;
    }

    if (row.reach !== null) {
      reachTotal += row.reach;
      hasReach = true;
    }
  }

  const engagement = likes + comments + shares;
  // Mẫu số phải cùng đơn vị: nếu có impressions thì chỉ cộng impressions,
  // trộn reach vào sẽ làm tỷ lệ sai.
  const denominator = hasImpressions ? impressionsTotal : hasReach ? reachTotal : 0;

  return {
    likes,
    comments,
    shares,
    impressions: hasImpressions ? impressionsTotal : null,
    engagementRate: denominator > 0 ? round((engagement / denominator) * 100, 2) : null,
  };
};

export const computeDelta = (current: number | null, previous: number | null): number | null => {
  if (current === null || previous === null || previous === 0) return null;
  return round(((current - previous) / previous) * 100, 1);
};

export const buildSeries = (rows: MetricRow[], window: DateWindow): SeriesPoint[] => {
  const buckets = new Map<string, SeriesPoint>();

  for (const row of rows) {
    const key = vnDateKey(row.publishedAt);
    const point = buckets.get(key) ?? { date: key, posts: 0, reach: 0, impressions: 0 };
    point.posts += 1;
    point.reach += row.reach ?? 0;
    point.impressions += row.impressions ?? 0;
    buckets.set(key, point);
  }

  const series: SeriesPoint[] = [];
  const lastDay = startOfVnDay(window.end).getTime();

  for (let day = startOfVnDay(window.start).getTime(); day <= lastDay; day += DAY_MS) {
    const key = vnDateKey(new Date(day));
    series.push(buckets.get(key) ?? { date: key, posts: 0, reach: 0, impressions: 0 });
  }

  return series;
};

export default {
  VN_OFFSET_MS,
  startOfVnDay,
  startOfVnMonth,
  resolveRange,
  computeSummary,
  computeDelta,
  buildSeries,
};
