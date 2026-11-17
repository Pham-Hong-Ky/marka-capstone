import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  analyticsService,
  type AnalyticsFilters,
  type AnalyticsPostsParams,
} from '@/services/analytics';
import { queryKeys } from '@/lib/queryKeys';

interface AnalyticsOverviewOptions {
  refetchInterval?: number | false;
  enabled?: boolean;
}

export const useAnalyticsOverview = (
  workspaceId: string | null,
  filters: AnalyticsFilters,
  options?: AnalyticsOverviewOptions
) =>
  useQuery({
    queryKey: queryKeys.analytics.overview(workspaceId, filters),
    queryFn: () => analyticsService.getOverview(workspaceId as string, filters),
    enabled: Boolean(workspaceId) && (options?.enabled ?? true),
    refetchInterval: options?.refetchInterval,
  });

export const useAnalyticsPosts = (
  workspaceId: string | null,
  params: AnalyticsPostsParams,
  options?: { enabled?: boolean }
) =>
  useQuery({
    queryKey: queryKeys.analytics.posts(workspaceId, params),
    queryFn: () => analyticsService.getPosts(workspaceId as string, params),
    enabled: Boolean(workspaceId) && (options?.enabled ?? true),
    placeholderData: keepPreviousData,
  });

export const useAnalyticsSuggestions = (workspaceId: string | null, channelId?: string) =>
  useQuery({
    queryKey: queryKeys.analytics.suggestions(workspaceId, channelId),
    queryFn: () => analyticsService.getSuggestions(workspaceId as string, { channelId }),
    enabled: Boolean(workspaceId),
  });

export const useSyncAnalytics = (workspaceId: string | null) =>
  useMutation({
    mutationFn: () => analyticsService.syncMetrics(workspaceId as string),
    onSuccess: () => toast.success('Đã đưa yêu cầu đồng bộ vào hàng đợi.'),
  });

export default {
  useAnalyticsOverview,
  useAnalyticsPosts,
  useAnalyticsSuggestions,
  useSyncAnalytics,
};
