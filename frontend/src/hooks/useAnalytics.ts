import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { analyticsService, type AnalyticsFilters } from '@/services/analytics';
import { getErrorMessage } from '@/utils/error';

interface AnalyticsOverviewOptions {
  refetchInterval?: number | false;
  enabled?: boolean;
}

export const analyticsKeys = {
  overview: (workspaceId: string | null, filters: AnalyticsFilters) =>
    ['analytics', 'overview', workspaceId, filters] as const,
  suggestions: (workspaceId: string | null, channelId?: string) =>
    ['analytics', 'suggestions', workspaceId, channelId ?? 'all'] as const,
};

export const useAnalyticsOverview = (
  workspaceId: string | null,
  filters: AnalyticsFilters,
  options?: AnalyticsOverviewOptions
) =>
  useQuery({
    queryKey: analyticsKeys.overview(workspaceId, filters),
    queryFn: () => analyticsService.getOverview(workspaceId as string, filters),
    enabled: Boolean(workspaceId) && (options?.enabled ?? true),
    refetchInterval: options?.refetchInterval,
  });

export const useAnalyticsSuggestions = (workspaceId: string | null, channelId?: string) =>
  useQuery({
    queryKey: analyticsKeys.suggestions(workspaceId, channelId),
    queryFn: () => analyticsService.getSuggestions(workspaceId as string, { channelId }),
    enabled: Boolean(workspaceId),
  });

export const useSyncAnalytics = (workspaceId: string | null) =>
  useMutation({
    mutationFn: () => analyticsService.syncMetrics(workspaceId as string),
    onSuccess: () => toast.success('Đã đưa yêu cầu đồng bộ vào hàng đợi.'),
    onError: (error) => toast.error(getErrorMessage(error)),
  });

export default {
  useAnalyticsOverview,
  useAnalyticsSuggestions,
  useSyncAnalytics,
};
