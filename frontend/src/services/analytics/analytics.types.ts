import type { ChannelPlatform } from '@/services/channel';
import type { PaginationMeta } from '@/types';

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
  reach: number | null;
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
  engagement: number;
}

export interface AnalyticsCoverage {
  publishedPosts: number;
  syncedPosts: number;
  missingImpressions: number;
  lastSyncedAt: string | null;
}

export interface AnalyticsChannelBreakdown extends AnalyticsSummary {
  channelId: string;
  name: string;
  platform: ChannelPlatform;
  posts: number;
  engagement: number;
}

export interface AnalyticsOverview {
  summary: AnalyticsSummary & { deltas: AnalyticsDeltas };
  series: AnalyticsSeriesPoint[];
  byChannel: AnalyticsChannelBreakdown[];
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

export interface AnalyticsSuggestions {
  bestTimes: BestTimeSlot[];
  usedFallback: boolean;
  sampleSize: number;
  windowDays: number;
}

export type AnalyticsPostSort = 'publishedAt' | 'impressions' | 'engagement';

export type AnalyticsSyncStatus = 'synced' | 'partial' | 'failed' | 'pending';

export interface AnalyticsPostsParams {
  filters: AnalyticsFilters;
  sort: AnalyticsPostSort;
  page: number;
  limit?: number;
}

export interface AnalyticsPostRow {
  id: string;
  postId: string;
  title: string;
  publishedAt: string | null;
  channel: { id: string; name: string; platform: ChannelPlatform };
  reactions: number;
  comments: number;
  shares: number;
  impressions: number | null;
  reach: number | null;
  syncStatus: AnalyticsSyncStatus;
  syncError: string | null;
}

export interface AnalyticsPostsResult {
  posts: AnalyticsPostRow[];
  meta: PaginationMeta;
}
