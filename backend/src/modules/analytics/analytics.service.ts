import { getErrorMessage } from '../../utils/errorMessage.js';
import logger from '../../utils/logger.js';
import { decryptOrNull } from '../../utils/encryption.js';
import { facebookClient } from '../channel/facebook.client.js';
import renderContentToPlainText from '../schedule/schedule.content.js';
import analyticsRepository from './analytics.repository.js';
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
  buildContentTips,
  shouldPenalizeExternalLinks,
  type DraftPost,
  type SuggestionRow,
} from './analytics.suggestion.js';
import type { AnalyticsOverviewQuery, AnalyticsSuggestionsQuery } from './analytics.validation.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const SYNC_STALE_MS = 6 * 60 * 60 * 1000;
const SYNC_WINDOW_MS = 30 * DAY_MS;
const SYNC_BATCH_SIZE = 50;
const SUGGESTION_WINDOW_DAYS = 90;
const EXTERNAL_LINK_PATTERN = /https?:\/\//i;

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

const buildDeltas = (current: Summary, previous: Summary) => ({
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

  const synced = rows.filter((row) => row.metric !== null && row.metric.syncError === null);
  const lastSyncedAt = synced.reduce<Date | null>((latest, row) => {
    const fetchedAt = row.metric?.fetchedAt;
    if (!fetchedAt) return latest;
    return !latest || fetchedAt > latest ? fetchedAt : latest;
  }, null);

  return {
    summary: { ...summary, deltas: buildDeltas(summary, previousSummary) },
    series: buildSeries(metricRows, current),
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

export const getSuggestions = async (
  workspaceId: string,
  query: AnalyticsSuggestionsQuery
) => {
  const since = new Date(Date.now() - SUGGESTION_WINDOW_DAYS * DAY_MS);

  const [publishedRows, drafts] = await Promise.all([
    analyticsRepository.findPublishedForSuggestions({
      workspaceId,
      since,
      channelId: query.channelId,
    }),
    analyticsRepository.findDraftPostsForSuggestions(workspaceId),
  ]);

  const suggestionRows: SuggestionRow[] = publishedRows
    .filter((row): row is typeof row & { publishedAt: Date } => row.publishedAt !== null)
    .map((row) => ({
      publishedAt: row.publishedAt,
      ...mapMetricFields(row.metric),
      hasLink: EXTERNAL_LINK_PATTERN.test(renderContentToPlainText(row.post.content)),
    }));

  const bestTimes = buildBestTimes(suggestionRows);
  const draftPosts: DraftPost[] = drafts.map((post) => ({
    id: post.id,
    title: post.title,
    text: renderContentToPlainText(post.content),
    hasMedia: post.mediaAssets.length > 0,
    scheduledAt: post.scheduledPosts[0]?.scheduledAt ?? null,
    updatedAt: post.updatedAt,
  }));

  return {
    bestTimes: bestTimes.slots,
    usedFallback: bestTimes.usedFallback,
    sampleSize: bestTimes.sampleSize,
    windowDays: SUGGESTION_WINDOW_DAYS,
    contentTips: buildContentTips(draftPosts, bestTimes.slots, {
      penalizeExternalLinks: shouldPenalizeExternalLinks(suggestionRows),
    }),
  };
};

const readToken = (encryptedToken: string | null): string | null =>
  decryptOrNull(encryptedToken);

export const syncMetrics = async (options: { workspaceId?: string } = {}) => {
  const now = new Date();
  const schedules = await analyticsRepository.findSchedulesToSync({
    workspaceId: options.workspaceId,
    publishedSince: new Date(now.getTime() - SYNC_WINDOW_MS),
    staleBefore: new Date(now.getTime() - SYNC_STALE_MS),
    take: SYNC_BATCH_SIZE,
  });

  let synced = 0;
  let failed = 0;

  for (const schedule of schedules) {
    const token = readToken(schedule.channel.accessToken);

    if (!schedule.externalPostId || !token) {
      await analyticsRepository.markMetricError(
        schedule.id,
        'Không đọc được token của Page. Vui lòng kết nối lại.'
      );
      failed += 1;
      continue;
    }

    try {
      const metrics = await facebookClient.fetchPostMetrics(schedule.externalPostId, token);
      await analyticsRepository.saveMetric(schedule.id, metrics);
      synced += 1;
    } catch (error) {
      const message = getErrorMessage(error);
      if (facebookClient.isTokenExpiredError(error)) {
        await analyticsRepository.markChannelExpired(schedule.channel.id);
      }
      await analyticsRepository.markMetricError(schedule.id, message);
      logger.warn(`Đồng bộ số liệu bài ${schedule.externalPostId} thất bại: ${message}`);
      failed += 1;
    }
  }

  return { total: schedules.length, synced, failed };
};

export default { getOverview, getSuggestions, syncMetrics };
