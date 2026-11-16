import logger from '../../../../utils/logger.js';
import { getErrorMessage } from '../../../../utils/errorMessage.js';
import { SocialTokenExpiredError } from '../errors/social.errors.js';
import type { ProviderMetrics } from '../port/social-provider.port.js';
import {
  facebookGet,
  type FacebookInsightsResponse,
  type FacebookPostFieldsResponse,
} from './facebook.graph.js';

export const fetchFacebookMetrics = async (
  externalPostId: string,
  accessToken: string
): Promise<ProviderMetrics> => {
  const fields = await facebookGet<FacebookPostFieldsResponse>(`/${externalPostId}`, {
    fields: 'reactions.limit(0).summary(true),comments.limit(0).summary(true),shares',
    access_token: accessToken,
  });

  const metrics: ProviderMetrics = {
    reactions: fields.reactions?.summary?.total_count ?? 0,
    comments: fields.comments?.summary?.total_count ?? 0,
    shares: fields.shares?.count ?? 0,
    impressions: null,
    reach: null,
    reactionsDetail: null,
    partialError: null,
  };

  try {
    const insights = await facebookGet<FacebookInsightsResponse>(
      `/${externalPostId}/insights`,
      {
        metric: 'post_impressions,post_impressions_unique,post_reactions_by_type_total',
        period: 'lifetime',
        access_token: accessToken,
      }
    );

    for (const insight of insights.data ?? []) {
      const value = insight.values?.[0]?.value;

      if (insight.name === 'post_impressions' && typeof value === 'number') {
        metrics.impressions = value;
      }
      if (insight.name === 'post_impressions_unique' && typeof value === 'number') {
        metrics.reach = value;
      }
      if (insight.name === 'post_reactions_by_type_total' && value && typeof value === 'object') {
        metrics.reactionsDetail = value;
      }
    }
  } catch (error) {
    if (error instanceof SocialTokenExpiredError) throw error;

    metrics.partialError = getErrorMessage(error);
    logger.warn(
      `Không lấy được insights của bài ${externalPostId}: ${metrics.partialError}`
    );
  }

  return metrics;
};
