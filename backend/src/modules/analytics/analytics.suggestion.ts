import { VN_OFFSET_MS } from './analytics.aggregate.js';

export interface SuggestionRow {
  publishedAt: Date;
  reactions: number;
  comments: number;
  shares: number;
  impressions: number | null;
  reach: number | null;
}

export interface BestTimeSlot {
  weekday: number | null;
  startHour: number;
  endHour: number;
  engagementRate: number | null;
  postCount: number;
  source: 'data' | 'benchmark';
}

const DEFAULT_SLOTS = 3;
const MIN_POSTS_PER_SLOT = 3;

const BENCHMARK_SLOTS: Array<Pick<BestTimeSlot, 'startHour' | 'endHour'>> = [
  { startHour: 11, endHour: 13 },
  { startHour: 18, endHour: 20 },
  { startHour: 19, endHour: 21 },
  { startHour: 7, endHour: 9 },
];

const round = (value: number): number => Math.round(value * 100) / 100;

const engagementRateOf = (row: SuggestionRow): number | null => {
  const denominator = row.impressions ?? row.reach;
  if (!denominator || denominator <= 0) return null;
  return ((row.reactions + row.comments + row.shares) / denominator) * 100;
};

const vnParts = (date: Date) => {
  const shifted = new Date(date.getTime() + VN_OFFSET_MS);
  return { weekday: shifted.getUTCDay(), hour: shifted.getUTCHours() };
};

const overlaps = (slot: BestTimeSlot, startHour: number, endHour: number): boolean =>
  slot.startHour < endHour && startHour < slot.endHour;

interface TimeBucket {
  weekday: number;
  startHour: number;
  count: number;
  rateSum: number;
}

const buildTimeBuckets = (rows: SuggestionRow[]) => {
  const buckets = new Map<string, TimeBucket>();
  let sampleSize = 0;

  for (const row of rows) {
    const rate = engagementRateOf(row);
    if (rate === null) continue;

    sampleSize += 1;
    const { weekday, hour } = vnParts(row.publishedAt);
    const startHour = Math.floor(hour / 2) * 2;
    const key = `${weekday}-${startHour}`;
    const bucket = buckets.get(key) ?? { weekday, startHour, count: 0, rateSum: 0 };
    bucket.count += 1;
    bucket.rateSum += rate;
    buckets.set(key, bucket);
  }

  return { buckets, sampleSize };
};

const toDataSlots = (buckets: Map<string, TimeBucket>): BestTimeSlot[] =>
  [...buckets.values()]
    .filter((bucket) => bucket.count >= MIN_POSTS_PER_SLOT)
    .map((bucket) => ({
      weekday: bucket.weekday,
      startHour: bucket.startHour,
      endHour: bucket.startHour + 2,
      engagementRate: round(bucket.rateSum / bucket.count),
      postCount: bucket.count,
      source: 'data' as const,
    }))
    .sort(
      (a, b) =>
        (b.engagementRate ?? 0) - (a.engagementRate ?? 0) ||
        b.postCount - a.postCount ||
        a.startHour - b.startHour
    )
    .slice(0, DEFAULT_SLOTS);

const fillBenchmarkSlots = (dataSlots: BestTimeSlot[]): BestTimeSlot[] => {
  const slots = [...dataSlots];

  for (const benchmark of BENCHMARK_SLOTS) {
    if (slots.length >= DEFAULT_SLOTS) break;
    if (slots.some((slot) => overlaps(slot, benchmark.startHour, benchmark.endHour))) continue;

    slots.push({
      weekday: null,
      startHour: benchmark.startHour,
      endHour: benchmark.endHour,
      engagementRate: null,
      postCount: 0,
      source: 'benchmark',
    });
  }

  return slots;
};

export const buildBestTimes = (
  rows: SuggestionRow[]
): { slots: BestTimeSlot[]; usedFallback: boolean; sampleSize: number } => {
  const { buckets, sampleSize } = buildTimeBuckets(rows);
  const dataSlots = toDataSlots(buckets);
  const slots = fillBenchmarkSlots(dataSlots);

  return { slots, usedFallback: slots.length > dataSlots.length, sampleSize };
};

export default { buildBestTimes };
