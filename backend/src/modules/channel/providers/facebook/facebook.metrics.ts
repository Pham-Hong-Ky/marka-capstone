import logger from '../../../../utils/logger.js';
import { getErrorMessage } from '../../../../utils/errorMessage.js';
import { SocialTokenExpiredError } from '../errors/social.errors.js';
import type { ProviderMetrics } from '../port/social-provider.port.js';
import {
  facebookGet,
  type FacebookInsightsResponse,
  type FacebookPostFieldsResponse,
} from './facebook.graph.js';

// Tách từng nhóm field: reactions/comments cần pages_read_user_content, shares thì không.
const POST_FIELD_GROUPS = [
  'shares',
  'reactions.limit(0).summary(true)',
  'comments.limit(0).summary(true)',
];

const fetchPostFields = async (
  externalPostId: string,
  accessToken: string
): Promise<{ fields: FacebookPostFieldsResponse; errors: string[] }> => {
  const results = await Promise.allSettled(
    POST_FIELD_GROUPS.map((fields) =>
      facebookGet<FacebookPostFieldsResponse>(`/${externalPostId}`, {
        fields,
        access_token: accessToken,
      })
    )
  );

  const rejected = results.filter(
    (result): result is PromiseRejectedResult => result.status === 'rejected'
  );
  const tokenExpired = rejected.find((result) => result.reason instanceof SocialTokenExpiredError);
  if (tokenExpired) throw tokenExpired.reason;
  if (rejected.length === results.length) throw rejected[0].reason;

  const fields: FacebookPostFieldsResponse = {};
  for (const result of results) {
    if (result.status === 'fulfilled') Object.assign(fields, result.value);
  }

  return { fields, errors: rejected.map((result) => getErrorMessage(result.reason)) };
};

export const fetchFacebookMetrics = async (
  externalPostId: string,
  accessToken: string
): Promise<ProviderMetrics> => {
  const { fields, errors } = await fetchPostFields(externalPostId, accessToken);

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
        metric: 'post_media_view,post_total_media_view_unique,post_reactions_by_type_total',
        period: 'lifetime',
        access_token: accessToken,
      }
    );

    for (const insight of insights.data ?? []) {
      const value = insight.values?.[0]?.value;

      if (insight.name === 'post_media_view' && typeof value === 'number') {
        metrics.impressions = value;
      }
      if (insight.name === 'post_total_media_view_unique' && typeof value === 'number') {
        metrics.reach = value;
      }
      if (insight.name === 'post_reactions_by_type_total' && value && typeof value === 'object') {
        metrics.reactionsDetail = value;
      }
    }
  } catch (error) {
    if (error instanceof SocialTokenExpiredError) throw error;

    errors.push(getErrorMessage(error));
  }

  if (errors.length > 0) {
    metrics.partialError = errors.join(' | ');
    logger.warn(`Không lấy đủ số liệu của bài ${externalPostId}: ${metrics.partialError}`);
  }

  return metrics;
};
