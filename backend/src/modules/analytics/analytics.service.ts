import { getErrorMessage } from '../../utils/errorMessage.js';
import { buildPaginationMeta } from '../../utils/pagination.js';
import logger from '../../utils/logger.js';
import { decryptOrNull } from '../../utils/encryption.js';
import { TooManyRequestsError } from '../../utils/errors/index.js';
import redis from '../../config/redis.js';
import { enqueue } from '../../workers/queue-manager.js';
import { QUEUE_NAMES } from '../../workers/types.js';
import { getProvider } from '../channel/providers/provider.registry.js';
import { SocialTokenExpiredError } from '../channel/providers/errors/social.errors.js';
import analyticsRepository, { isFailedSync } from './analytics.repository.js';
import {
  buildSeries,
  computeDelta,
  computeSummary,
  resolveRange,
  type MetricRow,
  type Summary,
} from './analytics.aggregate.js';
import {
  buildBestTimes,
  type SuggestionRow,
} from './analytics.suggestion.js';
import type {
  AnalyticsOverviewQuery,
  AnalyticsPostsQuery,
  AnalyticsSuggestionsQuery,
} from './analytics.validation.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const SYNC_WINDOW_MS = 30 * DAY_MS;
// Bài càng mới số liệu đổi càng nhanh nên làm mới dày hơn; bài cũ thưa dần để tiết kiệm lượt gọi API.
const SYNC_REFRESH_TIERS = [
  { maxAgeMs: DAY_MS, refreshMs: HOUR_MS },
  { maxAgeMs: 7 * DAY_MS, refreshMs: 6 * HOUR_MS },
  { maxAgeMs: SYNC_WINDOW_MS, refreshMs: 24 * HOUR_MS },
];
const SYNC_BATCH_SIZE = 50;
const MANUAL_SYNC_COOLDOWN_SECONDS = 5 * 60;
const SUGGESTION_WINDOW_DAYS = 90;

const mapMetricFields = (metric: {
  reactions: number;
  comments: number;
  shares: number;
  impressions: number | null;
  reach: number | null;
} | null) => ({
  reactions: metric?.reactions ?? 0,
  comments: metric?.comments ?? 0,
  shares: metric?.shares ?? 0,
  impressions: metric?.impressions ?? null,
  reach: metric?.reach ?? null,
});

const toMetricRows = (
  rows: Awaited<ReturnType<typeof analyticsRepository.findMetricRows>>
): MetricRow[] =>
  rows
    .filter((row): row is typeof row & { publishedAt: Date } => row.publishedAt !== null)
    .map((row) => ({
      publishedAt: row.publishedAt,
      ...mapMetricFields(row.metric),
    }));

type MetricRowRecord = Awaited<ReturnType<typeof analyticsRepository.findMetricRows>>[number];

const channelDisplayName = (channel: { name: string; label: string | null }): string =>
  channel.label ?? channel.name;

const engagementOf = (metric: { reactions: number; comments: number; shares: number } | null) =>
  metric ? metric.reactions + metric.comments + metric.shares : 0;

const buildChannelBreakdown = (rows: MetricRowRecord[]) => {
  const groups = new Map<string, { channel: MetricRowRecord['channel']; rows: MetricRowRecord[] }>();

  for (const row of rows) {
    const group = groups.get(row.channel.id) ?? { channel: row.channel, rows: [] };
    group.rows.push(row);
    groups.set(row.channel.id, group);
  }

  return [...groups.values()]
    .map(({ channel, rows: channelRows }) => {
      const summary = computeSummary(toMetricRows(channelRows));

      return {
        channelId: channel.id,
        name: channelDisplayName(channel),
        platform: channel.platform,
        posts: channelRows.length,
        ...summary,
        engagement: summary.likes + summary.comments + summary.shares,
      };
    })
    .sort((a, b) => b.engagement - a.engagement);
};

const resolveSyncStatus = (metric: MetricRowRecord['metric']) => {
  if (!metric) return 'pending' as const;
  if (metric.syncError === null) return 'synced' as const;
  return isFailedSync(metric.syncError) ? ('failed' as const) : ('partial' as const);
};

const compareNullableDesc = (a: number | null, b: number | null): number =>
  (b ?? -1) - (a ?? -1);

const POST_SORTERS: Record<AnalyticsPostsQuery['sort'], (a: MetricRowRecord, b: MetricRowRecord) => number> = {
  publishedAt: (a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0),
  impressions: (a, b) => compareNullableDesc(a.metric?.impressions ?? null, b.metric?.impressions ?? null),
  engagement: (a, b) => engagementOf(b.metric) - engagementOf(a.metric),
};

const buildDeltas =(current: Summary, previous: Summary) => ({
  likes: computeDelta(current.likes, previous.likes),
  comments: computeDelta(current.comments, previous.comments),
  shares: computeDelta(current.shares, previous.shares),
  impressions: computeDelta(current.impressions, previous.impressions),
  engagementRate: computeDelta(current.engagementRate, previous.engagementRate),
});

export const getOverview = async (workspaceId: string, query: AnalyticsOverviewQuery) => {
  const { current, previous } = resolveRange(query.range, query.from, query.to);

  const [rows, previousRows, tags] = await Promise.all([
    analyticsRepository.findMetricRows({
      workspaceId,
      start: current.start,
      end: current.end,
      channelId: query.channelId,
      tag: query.tag,
    }),
    analyticsRepository.findMetricRows({
      workspaceId,
      start: previous.start,
      end: previous.end,
      channelId: query.channelId,
      tag: query.tag,
    }),
    analyticsRepository.findCampaignTags(workspaceId),
  ]);

  const metricRows = toMetricRows(rows);
  const summary = computeSummary(metricRows);
  const previousSummary = computeSummary(toMetricRows(previousRows));

  const synced = rows.filter((row) => row.metric !== null && !isFailedSync(row.metric.syncError));
  const lastSyncedAt = synced.reduce<Date | null>((latest, row) => {
    const fetchedAt = row.metric?.fetchedAt;
    if (!fetchedAt) return latest;
    return !latest || fetchedAt > latest ? fetchedAt : latest;
  }, null);

  return {
    summary: { ...summary, deltas: buildDeltas(summary, previousSummary) },
    series: buildSeries(metricRows, current),
    byChannel: buildChannelBreakdown(rows),
    coverage: {
      publishedPosts: rows.length,
      syncedPosts: synced.length,
      missingImpressions: synced.filter((row) => row.metric?.impressions === null).length,
      lastSyncedAt,
    },
    tags,
    range: { start: current.start, end: current.end },
  };
};

export const listPosts = async (workspaceId: string, query: AnalyticsPostsQuery) => {
  const { current } = resolveRange(query.range, query.from, query.to);
  const rows = await analyticsRepository.findMetricRows({
    workspaceId,
    start: current.start,
    end: current.end,
    channelId: query.channelId,
    tag: query.tag,
  });

  const start = (query.page - 1) * query.limit;
  const posts = rows
    .sort(POST_SORTERS[query.sort])
    .slice(start, start + query.limit)
    .map((row) => ({
      id: row.id,
      postId: row.post.id,
      title: row.post.title,
      publishedAt: row.publishedAt,
      channel: {
        id: row.channel.id,
        name: channelDisplayName(row.channel),
        platform: row.channel.platform,
      },
      ...mapMetricFields(row.metric),
      syncStatus: resolveSyncStatus(row.metric),
      syncError: row.metric?.syncError ?? null,
    }));

  return { posts, meta: buildPaginationMeta(query.page, query.limit, rows.length) };
};

export const getSuggestions = async (
  workspaceId: string,
  query: AnalyticsSuggestionsQuery
) => {
  const since = new Date(Date.now() - SUGGESTION_WINDOW_DAYS * DAY_MS);

  const publishedRows = await analyticsRepository.findPublishedForSuggestions({
    workspaceId,
    since,
    channelId: query.channelId,
  });

  const suggestionRows: SuggestionRow[] = publishedRows
    .filter((row): row is typeof row & { publishedAt: Date } => row.publishedAt !== null)
    .map((row) => ({
      publishedAt: row.publishedAt,
      ...mapMetricFields(row.metric),
    }));

  const bestTimes = buildBestTimes(suggestionRows);

  return {
    bestTimes: bestTimes.slots,
    usedFallback: bestTimes.usedFallback,
    sampleSize: bestTimes.sampleSize,
    windowDays: SUGGESTION_WINDOW_DAYS,
  };
};

const readToken = (encryptedToken: string | null): string | null =>
  decryptOrNull(encryptedToken);

const buildRefreshWindows = (now: Date) =>
  SYNC_REFRESH_TIERS.map((tier, index) => ({
    publishedFrom: new Date(now.getTime() - tier.maxAgeMs),
    publishedTo: index === 0 ? undefined : new Date(now.getTime() - SYNC_REFRESH_TIERS[index - 1].maxAgeMs),
    staleBefore: new Date(now.getTime() - tier.refreshMs),
  }));

export const syncMetrics = async (options: { workspaceId?: string; force?: boolean } = {}) => {
  const now = new Date();
  const schedules = await analyticsRepository.findSchedulesToSync({
    workspaceId: options.workspaceId,
    publishedSince: new Date(now.getTime() - SYNC_WINDOW_MS),
    refreshWindows: options.force ? null : buildRefreshWindows(now),
    take: SYNC_BATCH_SIZE,
  });

  logger.info(`[Analytics] Đồng bộ số liệu: ${schedules.length} bài cần làm mới (force=${Boolean(options.force)})`);

  let synced = 0;
  let failed = 0;

  for (const schedule of schedules) {
    const provider = getProvider(schedule.channel.platform);
    if (!provider.capabilities.supportsMetrics) continue;

    const token = readToken(schedule.channel.accessToken);

    if (!schedule.externalPostId || !token) {
      await analyticsRepository.markMetricError(
        schedule.id,
        'Không đọc được token của tài khoản. Vui lòng kết nối lại.'
      );
      failed += 1;
      continue;
    }

    try {
      const metrics = await provider.fetchMetrics(schedule.externalPostId, token);
      await analyticsRepository.saveMetric(schedule.id, metrics);
      synced += 1;
    } catch (error) {
      const message = getErrorMessage(error);
      if (error instanceof SocialTokenExpiredError) {
        await analyticsRepository.markChannelExpired(schedule.channel.id);
      }
      await analyticsRepository.markMetricError(schedule.id, message);
      logger.warn(`Đồng bộ số liệu bài ${schedule.externalPostId} thất bại: ${message}`);
      failed += 1;
    }
  }

  return { total: schedules.length, synced, failed };
};

const syncCooldownKey = (workspaceId: string) => `analytics:sync-cooldown:${workspaceId}`;

export const requestManualSync = async (workspaceId: string): Promise<void> => {
  const key = syncCooldownKey(workspaceId);
  const acquired = await redis.set(key, '1', 'EX', MANUAL_SYNC_COOLDOWN_SECONDS, 'NX');

  if (!acquired) {
    const remaining = Math.max(await redis.ttl(key), 1);
    throw new TooManyRequestsError(
      `Số liệu vừa được đồng bộ gần đây. Vui lòng thử lại sau ${remaining} giây.`
    );
  }

  try {
    // jobId theo workspace: gộp các yêu cầu đang chờ thành một job.
    await enqueue(
      QUEUE_NAMES.analytics,
      'analytics-sync',
      { workspaceId, force: true },
      { jobId: `analytics-sync-${workspaceId}`, removeOnComplete: true, removeOnFail: true }
    );
  } catch (error) {
    await redis.del(key);
    throw error;
  }
};

export default { getOverview, listPosts, getSuggestions, syncMetrics, requestManualSync };
