import { VN_OFFSET_MS } from './analytics.aggregate.js';

export interface SuggestionRow {
  publishedAt: Date;
  reactions: number;
  comments: number;
  shares: number;
  impressions: number | null;
  reach: number | null;
  hasLink: boolean;
}

export interface BestTimeSlot {
  weekday: number | null;
  startHour: number;
  endHour: number;
  engagementRate: number | null;
  postCount: number;
  source: 'data' | 'benchmark';
}

export interface DraftPost {
  id: string;
  title: string;
  text: string;
  hasMedia: boolean;
  scheduledAt: Date | null;
  updatedAt: Date;
}

export type TipSeverity = 'high' | 'medium' | 'low';

export type TipRule =
  | 'no_media'
  | 'too_short'
  | 'too_long'
  | 'no_cta'
  | 'too_many_hashtags'
  | 'outside_best_time'
  | 'external_link';

export interface ContentTip {
  postId: string;
  postTitle: string;
  rule: TipRule;
  severity: TipSeverity;
  message: string;
}

const DEFAULT_SLOTS = 3;
const MIN_POSTS_PER_SLOT = 3;
const MIN_CAPTION_LENGTH = 80;
const MAX_CAPTION_LENGTH = 1000;
const MAX_HASHTAGS = 3;

const BENCHMARK_SLOTS: Array<Pick<BestTimeSlot, 'startHour' | 'endHour'>> = [
  { startHour: 11, endHour: 13 },
  { startHour: 18, endHour: 20 },
  { startHour: 19, endHour: 21 },
  { startHour: 7, endHour: 9 },
];

const CTA_PATTERN =
  /\?|bình luận|comment|nhắn tin|inbox|đặt hàng|đăng ký|xem chi tiết|liên hệ/i;
const HASHTAG_PATTERN = /#[\p{L}\p{N}_]+/gu;
const LINK_PATTERN = /https?:\/\//i;

const SEVERITY_RANK: Record<TipSeverity, number> = { high: 0, medium: 1, low: 2 };

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

const isInsideSlot = (date: Date, slots: BestTimeSlot[]): boolean => {
  const { weekday, hour } = vnParts(date);
  return slots.some(
    (slot) =>
      (slot.weekday === null || slot.weekday === weekday) &&
      hour >= slot.startHour &&
      hour < slot.endHour
  );
};

const countHashtags = (text: string): number => text.match(HASHTAG_PATTERN)?.length ?? 0;

const meanEngagementRate = (rows: SuggestionRow[]): number | null => {
  const rates = rows
    .map((row) => engagementRateOf(row))
    .filter((rate): rate is number => rate !== null);

  if (rates.length === 0) return null;
  return rates.reduce((total, rate) => total + rate, 0) / rates.length;
};

export const shouldPenalizeExternalLinks = (rows: SuggestionRow[]): boolean => {
  const withLink = rows.filter((row) => row.hasLink);
  const withoutLink = rows.filter((row) => !row.hasLink);

  if (withLink.length < MIN_POSTS_PER_SLOT || withoutLink.length < MIN_POSTS_PER_SLOT) {
    return false;
  }

  const linkRate = meanEngagementRate(withLink);
  const plainRate = meanEngagementRate(withoutLink);

  if (linkRate === null || plainRate === null || plainRate <= 0) return false;

  return linkRate < plainRate * 0.8;
};

const buildTipsForDraft = (
  draft: DraftPost,
  dataSlots: BestTimeSlot[],
  penalizeExternalLinks: boolean
): ContentTip[] => {
  const tips: ContentTip[] = [];
  const text = draft.text.trim();
  const length = text.length;
  const add = (rule: TipRule, severity: TipSeverity, message: string) =>
    tips.push({ postId: draft.id, postTitle: draft.title, rule, severity, message });

  if (!draft.hasMedia) {
    add('no_media', 'high', 'Chưa có ảnh hoặc video — bài có ảnh thường được chú ý hơn trong bảng tin.');
  }

  if (length < MIN_CAPTION_LENGTH) {
    add(
      'too_short',
      'medium',
      `Caption chỉ có ${length} ký tự, nên viết từ ${MIN_CAPTION_LENGTH} ký tự để đủ ngữ cảnh.`
    );
  } else if (length > MAX_CAPTION_LENGTH) {
    add(
      'too_long',
      'medium',
      `Caption dài ${length} ký tự; nền tảng chỉ hiện phần đầu nên nên rút dưới ${MAX_CAPTION_LENGTH} ký tự.`
    );
  }

  const hashtagCount = countHashtags(text);
  if (hashtagCount > MAX_HASHTAGS) {
    add(
      'too_many_hashtags',
      'low',
      `Đang dùng ${hashtagCount} hashtag — nên giữ tối đa ${MAX_HASHTAGS}.`
    );
  }

  if (!CTA_PATTERN.test(text)) {
    add('no_cta', 'low', 'Chưa có lời kêu gọi hành động (câu hỏi, "bình luận", "nhắn tin"...).');
  }

  if (draft.scheduledAt && dataSlots.length > 0 && !isInsideSlot(draft.scheduledAt, dataSlots)) {
    add(
      'outside_best_time',
      'medium',
      'Thời điểm lên lịch nằm ngoài khung giờ có tương tác tốt nhất của Page.'
    );
  }

  if (penalizeExternalLinks && LINK_PATTERN.test(text)) {
    add(
      'external_link',
      'medium',
      'Có link ngoài — các bài có link đang có tỷ lệ tương tác thấp hơn trên Page của bạn.'
    );
  }

  return tips;
};

export const buildContentTips = (
  drafts: DraftPost[],
  slots: BestTimeSlot[],
  options: { penalizeExternalLinks?: boolean } = {}
): ContentTip[] => {
  const dataSlots = slots.filter((slot) => slot.source === 'data');
  const tips = drafts.flatMap((draft) =>
    buildTipsForDraft(draft, dataSlots, options.penalizeExternalLinks ?? false)
  );

  return tips
    .sort(
      (a, b) =>
        SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
        (drafts.find((draft) => draft.id === b.postId)?.updatedAt.getTime() ?? 0) -
          (drafts.find((draft) => draft.id === a.postId)?.updatedAt.getTime() ?? 0)
    )
    .slice(0, 3);
};

export default { buildBestTimes, buildContentTips, shouldPenalizeExternalLinks };
