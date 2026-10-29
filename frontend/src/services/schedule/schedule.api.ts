import httpClient from '../httpClient';
import { unwrap, unwrapPaginated } from '../http';
import type { ApiResponse } from '@/types';
import type {
  CreateSchedulePayload,
  CreateScheduleResult,
  ScheduleListMeta,
  ScheduleListParams,
  ScheduleListResult,
} from './schedule.types';

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
  const response = await httpClient.get<
    ApiResponse<{ schedules: ScheduleListResult['schedules'] }, ScheduleListMeta>
  >(`/workspaces/${workspaceId}/schedules`, { params });
  const { data, meta } = unwrapPaginated(response);

  return { schedules: data.schedules, meta };
};

export const cancelSchedule = async (workspaceId: string, scheduleId: string): Promise<void> => {
  await httpClient.delete(`/workspaces/${workspaceId}/schedules/${scheduleId}`);
};

export default {
  createSchedules,
  listSchedules,
  cancelSchedule,
};
