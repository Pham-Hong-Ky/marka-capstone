import type { ProviderMetrics } from '../port/social-provider.port.js';
import { requestGraph } from '../transport/graph-request.js';
import {
  threadsApiUrl,
  threadsRequest,
  type ThreadsErrorBody,
  type ThreadsInsightsResponse,
} from './threads.graph.js';

const insightValue = (data: ThreadsInsightsResponse['data'], name: string): number => {
  const insight = data?.find((item) => item.name === name);
  const value = insight?.values?.[0]?.value;
  return typeof value === 'number' ? value : 0;
};

const mapInsights = (
  body: ThreadsInsightsResponse,
  partialError: string | null
): ProviderMetrics => {
  const reposts = insightValue(body.data, 'reposts');
  const quotes = insightValue(body.data, 'quotes');
  const shares = insightValue(body.data, 'shares');

  return {
    reactions: insightValue(body.data, 'likes'),
    comments: insightValue(body.data, 'replies'),
    shares: reposts + quotes + shares,
    impressions: body.data?.some((item) => item.name === 'views')
      ? insightValue(body.data, 'views')
      : null,
    reach: null,
    reactionsDetail: null,
    partialError,
  };
};

export const fetchThreadsMetrics = async (
  externalPostId: string,
  accessToken: string
): Promise<ProviderMetrics> => {
  const requestInsights = (metric: string) =>
    requestGraph<ThreadsInsightsResponse & ThreadsErrorBody>(
      threadsApiUrl(`/${externalPostId}/insights`, { metric, access_token: accessToken })
    );

  const allMetrics = 'views,likes,replies,reposts,quotes,shares';
  const first = await requestInsights(allMetrics);

  if (first.ok && !first.body?.error) {
    return mapInsights(first.body ?? { data: [] }, null);
  }

  const partialError = (
    first.body?.error?.message ??
    first.body?.error_message ??
    `HTTP ${first.status}`
  ).slice(0, 255);

  const body = await threadsRequest<ThreadsInsightsResponse>(
    threadsApiUrl(`/${externalPostId}/insights`, {
      metric: 'likes,replies,reposts,quotes',
      access_token: accessToken,
    })
  );
  return mapInsights(body, partialError);
};
