import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  scheduleService,
  type CreateSchedulePayload,
  type ScheduleListParams,
} from '@/services/schedule';
import { queryKeys } from '@/lib/queryKeys';
import { getErrorMessage } from '@/utils/error';
import { hasPublishInProgress, PUBLISH_POLL_INTERVAL_MS } from '@/utils/schedule';

const invalidateScheduleData = (queryClient: QueryClient, workspaceId: string) => {
  queryClient.invalidateQueries({ queryKey: queryKeys.schedule.workspace(workspaceId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.post.workspace(workspaceId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.post.detailWorkspace(workspaceId) });
};

export const useSchedules = (workspaceId: string | null, params: ScheduleListParams) =>
  useQuery({
    queryKey: queryKeys.schedule.list(workspaceId ?? '', params),
    queryFn: () => scheduleService.listSchedules(workspaceId as string, params),
    enabled: Boolean(workspaceId),
    placeholderData: keepPreviousData,
    refetchInterval: (query) =>
      hasPublishInProgress(query.state.data?.schedules) ? PUBLISH_POLL_INTERVAL_MS : false,
  });

export const useCreateSchedules = (workspaceId: string | null) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, payload }: { postId: string; payload: CreateSchedulePayload }) =>
      scheduleService.createSchedules(workspaceId as string, postId, payload),
    onSuccess: (_data, variables) => {
      if (workspaceId) invalidateScheduleData(queryClient, workspaceId);
      toast.success(
        variables.payload.scheduledAt
          ? 'Lên lịch đăng bài thành công'
          : 'Đã đưa bài vào hàng đợi đăng'
      );
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
};

export const useCancelSchedule = (workspaceId: string | null) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (scheduleId: string) => scheduleService.cancelSchedule(workspaceId as string, scheduleId),
    onSuccess: () => {
      if (workspaceId) invalidateScheduleData(queryClient, workspaceId);
      toast.success('Huỷ lịch đăng thành công');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
};
