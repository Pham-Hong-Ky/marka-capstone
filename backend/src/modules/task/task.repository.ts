import type { Prisma, TaskStatus } from '@prisma/client';
import prisma from '../../config/db.js';

const TASK_ASSIGNEE_SELECT = { id: true, name: true, avatar: true } as const;
const TASK_POST_SELECT = { id: true, title: true, status: true } as const;

export const TASK_SELECT = {
  id: true,
  workspaceId: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  assignedAt: true,
  dueAt: true,
  assignee: { select: TASK_ASSIGNEE_SELECT },
  post: { select: TASK_POST_SELECT },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TaskSelect;

export const createTask = async (data: Prisma.TaskUncheckedCreateInput) =>
  prisma.task.create({ data, select: TASK_SELECT });

export const findTaskById = async (taskId: string, workspaceId: string) =>
  prisma.task.findFirst({ where: { id: taskId, workspaceId }, select: TASK_SELECT });

export interface BoardTaskFilters {
  workspaceId: string;
  assigneeId?: string;
  includeUnassigned: boolean;
  search?: string;
  priority?: number;
  limit: number;
}

type BoardTaskWhereFilters = Omit<BoardTaskFilters, 'limit'>;

const buildWhere = (
  filters: BoardTaskWhereFilters,
  status: TaskStatus,
  unassigned = false
): Prisma.TaskWhereInput => ({
  workspaceId: filters.workspaceId,
  status,
  assigneeId: unassigned ? null : filters.assigneeId ?? { not: null },
  ...(filters.search ? { title: { contains: filters.search, mode: 'insensitive' } } : {}),
  ...(filters.priority ? { priority: filters.priority } : {}),
});

const BOARD_ORDER_BY: Prisma.TaskOrderByWithRelationInput[] = [
  { priority: 'asc' },
  { dueAt: { sort: 'asc', nulls: 'last' } },
  { updatedAt: 'desc' },
];

export const findBoardTasks = async (filters: BoardTaskFilters) => {
  const [unassigned, todo, inProgress, done] = await Promise.all([
    filters.includeUnassigned
      ? prisma.task.findMany({
          where: buildWhere(filters, 'TODO', true),
          orderBy: BOARD_ORDER_BY,
          take: filters.limit,
          select: TASK_SELECT,
        })
      : [],
    prisma.task.findMany({
      where: buildWhere(filters, 'TODO'),
      orderBy: BOARD_ORDER_BY,
      take: filters.limit,
      select: TASK_SELECT,
    }),
    prisma.task.findMany({
      where: buildWhere(filters, 'IN_PROGRESS'),
      orderBy: BOARD_ORDER_BY,
      take: filters.limit,
      select: TASK_SELECT,
    }),
    prisma.task.findMany({
      where: buildWhere(filters, 'DONE'),
      orderBy: BOARD_ORDER_BY,
      take: filters.limit,
      select: TASK_SELECT,
    }),
  ]);

  return { unassigned, todo, inProgress, done };
};

export interface UpdateTaskData {
  title?: string;
  description?: string;
  dueAt?: Date | null;
  priority?: number;
}

export const updateTask = async (taskId: string, data: UpdateTaskData) =>
  prisma.task.update({ where: { id: taskId }, data, select: TASK_SELECT });

export const linkTaskPost = async (taskId: string, postId: string | null) =>
  prisma.task.update({ where: { id: taskId }, data: { postId }, select: TASK_SELECT });

export const softDeleteTask = async (taskId: string) =>
  prisma.task.update({
    where: { id: taskId },
    data: { deletedAt: new Date(), postId: null },
    select: TASK_SELECT,
  });

export const findTaskByPostId = async (postId: string) =>
  prisma.task.findFirst({ where: { postId }, select: TASK_SELECT });

export interface AssignTaskData {
  assigneeId: string | null;
  assignedById: string | null;
  assignedAt: Date | null;
  dueAt: Date | null;
  status?: TaskStatus;
}

export const assignTask = async (taskId: string, data: AssignTaskData) =>
  prisma.task.update({ where: { id: taskId }, data, select: TASK_SELECT });

export const updateTaskStatus = async (taskId: string, status: TaskStatus) =>
  prisma.task.update({ where: { id: taskId }, data: { status }, select: TASK_SELECT });

export const countBoardTasks = async (filters: BoardTaskWhereFilters) => {
  const [unassigned, todo, inProgress, done] = await Promise.all([
    filters.includeUnassigned
      ? prisma.task.count({ where: buildWhere(filters, 'TODO', true) })
      : 0,
    prisma.task.count({ where: buildWhere(filters, 'TODO') }),
    prisma.task.count({ where: buildWhere(filters, 'IN_PROGRESS') }),
    prisma.task.count({ where: buildWhere(filters, 'DONE') }),
  ]);

  return { unassigned, todo, inProgress, done };
};

export default {
  TASK_SELECT,
  createTask,
  findTaskById,
  findBoardTasks,
  countBoardTasks,
  updateTask,
  assignTask,
  updateTaskStatus,
  linkTaskPost,
  softDeleteTask,
  findTaskByPostId,
};
