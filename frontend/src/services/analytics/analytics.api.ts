import httpClient from '../httpClient';
import { unwrap, unwrapPaginated } from '../http';
import type { ApiResponse, PaginationMeta } from '@/types';
import type {
  AnalyticsFilters,
  AnalyticsOverview,
  AnalyticsPostRow,
  AnalyticsPostsParams,
  AnalyticsPostsResult,
  AnalyticsSuggestions,
} from './analytics.types';

const base = (workspaceId: string) => `/workspaces/${workspaceId}/analytics`;

const buildOverviewParams = (filters: AnalyticsFilters) => {
  const params: Record<string, string> = { range: filters.range };

  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;
  if (filters.channelId) params.channelId = filters.channelId;
  if (filters.tag) params.tag = filters.tag;

  return params;
};

export const getOverview = async (
  workspaceId: string,
  filters: AnalyticsFilters
): Promise<AnalyticsOverview> =>
  unwrap(
    await httpClient.get<ApiResponse<AnalyticsOverview>>(`${base(workspaceId)}/overview`, {
      params: buildOverviewParams(filters),
    })
  );

export const getPosts = async (
  workspaceId: string,
  { filters, sort, page, limit }: AnalyticsPostsParams
): Promise<AnalyticsPostsResult> => {
  const response = await httpClient.get<
    ApiResponse<{ posts: AnalyticsPostRow[] }, PaginationMeta>
  >(`${base(workspaceId)}/posts`, {
    params: { ...buildOverviewParams(filters), sort, page, ...(limit ? { limit } : {}) },
  });
  const { data, meta } = unwrapPaginated(response);

  return { posts: data.posts, meta };
};

export const getSuggestions = async (
  workspaceId: string,
  params: { channelId?: string }
): Promise<AnalyticsSuggestions> =>
  unwrap(
    await httpClient.get<ApiResponse<AnalyticsSuggestions>>(`${base(workspaceId)}/suggestions`, {
      params,
    })
  );

export const syncMetrics = async (workspaceId: string): Promise<{ queued: boolean }> =>
  unwrap(
    await httpClient.post<ApiResponse<{ queued: boolean }>>(`${base(workspaceId)}/sync`, {})
  );

const analyticsService = {
  getOverview,
  getPosts,
  getSuggestions,
  syncMetrics,
};

export default analyticsService;
