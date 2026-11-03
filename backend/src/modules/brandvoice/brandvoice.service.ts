import brandVoiceRepository from './brandvoice.repository.js';
import auditService from '../audit/audit.service.js';
import type { BrandVoiceInput, BrandVoiceInsightsQuery } from './brandvoice.validation.js';
import { NotFoundError } from '../../utils/errors/index.js';
import renderContentToPlainText from '../schedule/schedule.content.js';
import { buildBrandVoiceInsights, type InsightPost } from './brandvoice.insight.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const INSIGHT_MIN_AGE_MS = 48 * 60 * 60 * 1000;

const dedupeKeywords = (keywords: string[]) => [...new Set(keywords)];

export const getBrandVoice = async (workspaceId: string) => {
  const workspace = await brandVoiceRepository.getBrandVoiceByWorkspaceId(workspaceId);
  if (!workspace) {
    throw new NotFoundError('Workspace không tồn tại');
  }

  const brandVoice = workspace.brandVoice ?? null;

  return { brandVoice, isConfigured: brandVoice !== null };
};

export const updateBrandVoice = async (
  workspaceId: string,
  userId: string,
  data: BrandVoiceInput
) => {
  const workspace = await brandVoiceRepository.findWorkspaceById(workspaceId);
  if (!workspace) {
    throw new NotFoundError('Workspace không tồn tại');
  }

  const brandVoice: BrandVoiceInput = {
    ...data,
    keywordsShouldUse: dedupeKeywords(data.keywordsShouldUse),
    keywordsAvoid: dedupeKeywords(data.keywordsAvoid),
  };

  await brandVoiceRepository.updateWorkspaceBrandVoice(workspaceId, brandVoice);

  await auditService.recordAuditLog({
    workspaceId,
    actorId: userId,
    action: 'BRAND_VOICE_UPDATED',
    targetType: 'Workspace',
    targetId: workspaceId,
  });

  return { brandVoice, isConfigured: true };
};

export const getInsights = async (
  workspaceId: string,
  query: BrandVoiceInsightsQuery
) => {
  const workspace = await brandVoiceRepository.findWorkspaceById(workspaceId);
  if (!workspace) {
    throw new NotFoundError('Workspace không tồn tại');
  }

  const since = new Date(Date.now() - query.windowDays * DAY_MS);
  const until = new Date(Date.now() - INSIGHT_MIN_AGE_MS);
  const rows = await brandVoiceRepository.findPublishedPostsForInsights({
    workspaceId,
    since,
    until,
    channelId: query.channelId,
  });

  const posts: InsightPost[] = rows.flatMap((row) => {
    if (!row.publishedAt || !row.metric) return [];
    if (row.metric.syncError !== null || row.metric.fetchedAt === null) return [];

    const text = renderContentToPlainText(row.customContent ?? row.post.content);
    if (text.length < 10) return [];

    return [
      {
        id: row.post.id,
        title: row.post.title,
        text,
        publishedAt: row.publishedAt,
        channelId: row.channel.id,
        channelName: row.channel.name,
        platform: row.channel.platform,
        hasMedia: row.post.mediaAssets.length > 0,
        metrics: {
          reactions: row.metric.reactions,
          comments: row.metric.comments,
          shares: row.metric.shares,
          reach: row.metric.reach,
          impressions: row.metric.impressions,
        },
      },
    ];
  });

  return buildBrandVoiceInsights({
    posts,
    limit: query.limit,
    windowDays: query.windowDays,
  });
};

export default {
  getBrandVoice,
  updateBrandVoice,
  getInsights,
};
