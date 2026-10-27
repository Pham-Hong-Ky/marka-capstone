export type AnalyticsRange = '7d' | '30d' | 'mtd' | 'lastMonth' | 'custom';

export interface AnalyticsFilters {
  range: AnalyticsRange;
  from?: string;
  to?: string;
  channelId?: string;
  tag?: string;
}

export interface AnalyticsSummary {
  likes: number;
  comments: number;
  shares: number;
  impressions: number | null;
  engagementRate: number | null;
}

export interface AnalyticsDeltas {
  likes: number | null;
  comments: number | null;
  shares: number | null;
  impressions: number | null;
  engagementRate: number | null;
}

export interface AnalyticsSeriesPoint {
  date: string;
  posts: number;
  reach: number;
  impressions: number;
}

export interface AnalyticsCoverage {
  publishedPosts: number;
  syncedPosts: number;
  missingImpressions: number;
  lastSyncedAt: string | null;
}

export interface AnalyticsOverview {
  summary: AnalyticsSummary & { deltas: AnalyticsDeltas };
  series: AnalyticsSeriesPoint[];
  coverage: AnalyticsCoverage;
  tags: string[];
  range: { start: string; end: string };
}

export interface BestTimeSlot {
  weekday: number | null;
  startHour: number;
  endHour: number;
  engagementRate: number | null;
  postCount: number;
  source: 'data' | 'benchmark';
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

export interface AnalyticsSuggestions {
  bestTimes: BestTimeSlot[];
  usedFallback: boolean;
  sampleSize: number;
  windowDays: number;
  contentTips: ContentTip[];
}
