import httpClient from '../httpClient';
import { unwrap } from '../http';
import type { ApiResponse } from '@/types';
import type {
  AssignTaskPayload,
  CreateTaskPayload,
  LinkTaskPostPayload,
  TaskBoard,
  TaskBoardParams,
  TaskItem,
  TaskStatus,
  UpdateTaskPayload,
} from './task.types';

const base = (workspaceId: string) => `/workspaces/${workspaceId}/tasks`;

export const listBoard = async (
  workspaceId: string,
  params: TaskBoardParams
): Promise<TaskBoard> =>
  unwrap(await httpClient.get<ApiResponse<TaskBoard>>(`${base(workspaceId)}/board`, { params }));

export const createTask = async (
  workspaceId: string,
  payload: CreateTaskPayload
): Promise<TaskItem> => unwrap(await httpClient.post<ApiResponse<TaskItem>>(base(workspaceId), payload));

export const updateTask = async (
  workspaceId: string,
  taskId: string,
  payload: UpdateTaskPayload
): Promise<TaskItem> =>
  unwrap(await httpClient.patch<ApiResponse<TaskItem>>(`${base(workspaceId)}/${taskId}`, payload));

export const assignTask = async (
  workspaceId: string,
  taskId: string,
  payload: AssignTaskPayload
): Promise<TaskItem> =>
  unwrap(
    await httpClient.patch<ApiResponse<TaskItem>>(`${base(workspaceId)}/${taskId}/assign`, payload)
  );

export const updateTaskStatus = async (
  workspaceId: string,
  taskId: string,
  status: TaskStatus
): Promise<TaskItem> =>
  unwrap(
    await httpClient.patch<ApiResponse<TaskItem>>(`${base(workspaceId)}/${taskId}/status`, {
      status,
    })
  );

export const linkPost = async (
  workspaceId: string,
  taskId: string,
  payload: LinkTaskPostPayload
): Promise<TaskItem> =>
  unwrap(
    await httpClient.patch<ApiResponse<TaskItem>>(`${base(workspaceId)}/${taskId}/post`, payload)
  );

export const deleteTask = async (workspaceId: string, taskId: string): Promise<void> => {
  await httpClient.delete(`${base(workspaceId)}/${taskId}`);
};

export default {
  listBoard,
  createTask,
  updateTask,
  assignTask,
  updateTaskStatus,
  linkPost,
  deleteTask,
};
