import httpClient from '../httpClient';
import { unwrap } from '../http';
import type { ApiResponse } from '@/types';
import type {
  CreateSchedulePayload,
  CreateScheduleResult,
  ScheduleListParams,
  ScheduleListResult,
} from './schedule.types';

const DEFAULT_META = { page: 1, limit: 20, total: 0, totalPages: 0 };

export const createSchedules = async (
  workspaceId: string,
  postId: string,
  payload: CreateSchedulePayload
): Promise<CreateScheduleResult> =>
  unwrap(
    await httpClient.post<ApiResponse<CreateScheduleResult>>(
      `/workspaces/${workspaceId}/posts/${postId}/schedules`,
      payload
    )
  );

export const listSchedules = async (
  workspaceId: string,
  params: ScheduleListParams
): Promise<ScheduleListResult> => {
  const response = await httpClient.get<ApiResponse<{ schedules: ScheduleListResult['schedules'] }>>(
    `/workspaces/${workspaceId}/schedules`,
    { params }
  );

  return {
    schedules: response.data.data?.schedules ?? [],
    meta: (response.data.meta as ScheduleListResult['meta'] | undefined) ?? DEFAULT_META,
  };
};

export const cancelSchedule = async (workspaceId: string, scheduleId: string): Promise<void> => {
  await httpClient.delete(`/workspaces/${workspaceId}/schedules/${scheduleId}`);
};

export default {
  createSchedules,
  listSchedules,
  cancelSchedule,
};
