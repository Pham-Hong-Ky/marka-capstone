import type { PostStatus } from '../post';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';

export interface TaskAssignee {
  id: string;
  name: string;
  avatar: string | null;
}

export interface TaskPostRef {
  id: string;
  title: string;
  status: PostStatus;
}

export interface TaskItem {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: number;
  assignee: TaskAssignee | null;
  assignedAt: string | null;
  dueAt: string | null;
  post: TaskPostRef | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskCounts {
  unassigned: number;
  todo: number;
  inProgress: number;
  done: number;
}

export interface TaskBoard {
  unassigned: TaskItem[];
  todo: TaskItem[];
  inProgress: TaskItem[];
  done: TaskItem[];
  counts: TaskCounts;
}

export type TaskColumn = keyof Omit<TaskBoard, 'counts'>;

export interface TaskBoardParams {
  mine?: boolean;
  search?: string;
  priority?: number;
}

export interface CreateTaskPayload {
  title: string;
  description?: string;
  assigneeId?: string;
  dueAt?: string;
  priority?: number;
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string;
  dueAt?: string | null;
  priority?: number;
}

export interface AssignTaskPayload {
  assigneeId: string | null;
}

export interface UpdateTaskStatusPayload {
  status: TaskStatus;
}

export interface LinkTaskPostPayload {
  postId: string | null;
}
