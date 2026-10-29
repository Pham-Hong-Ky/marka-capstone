import { Prisma, type WorkspaceRole } from '@prisma/client';
import taskRepository from './task.repository.js';
import taskNotification from './task.notification.js';
import postRepository from '../post/post.repository.js';
import type {
  AssignTaskBody,
  BoardQuery,
  CreateTaskBody,
  LinkTaskPostBody,
  UpdateTaskBody,
  UpdateTaskStatusBody,
} from './task.validation.js';
import workspaceService from '../workspace/workspace.service.js';
import auditService from '../audit/audit.service.js';
import { getErrorMessage } from '../../utils/errorMessage.js';
import logger from '../../utils/logger.js';
import { addDays } from '../../utils/date.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../utils/errors/index.js';

const BOARD_COLUMN_LIMIT = 100;

const notifySafely = async (action: () => Promise<void>) => {
  try {
    await action();
  } catch (error) {
    logger.warn(`Không gửi được thông báo công việc: ${getErrorMessage(error)}`);
  }
};

const assertDueAtValid = (dueAt?: Date | null, currentDueAt?: Date | null) => {
  if (!dueAt) return;

  const now = new Date();
  if (dueAt.getTime() < now.getTime()) {
    // Cho phép giữ nguyên hạn cũ đã qua khi chỉ sửa các trường khác.
    if (currentDueAt && dueAt.getTime() === currentDueAt.getTime()) return;
    throw new BadRequestError('Hạn chót không được ở quá khứ');
  }
  if (dueAt.getTime() > addDays(now, 365).getTime()) {
    throw new BadRequestError('Hạn chót tối đa 1 năm kể từ hiện tại');
  }
};

const assertAssigneeIsMember = async (workspaceId: string, assigneeId: string) => {
  if (!(await workspaceService.isWorkspaceMember(workspaceId, assigneeId))) {
    throw new BadRequestError('Người nhận việc không phải là thành viên của workspace');
  }
};

export const createTask = async (workspaceId: string, actorId: string, body: CreateTaskBody) => {
  assertDueAtValid(body.dueAt);

  if (body.assigneeId) {
    await assertAssigneeIsMember(workspaceId, body.assigneeId);
  }

  const assignedAt = body.assigneeId ? new Date() : null;
  const task = await taskRepository.createTask({
    workspaceId,
    title: body.title,
    description: body.description ?? null,
    status: 'TODO',
    priority: body.priority,
    assigneeId: body.assigneeId ?? null,
    assignedById: body.assigneeId ? actorId : null,
    assignedAt,
    dueAt: body.dueAt ?? null,
    createdById: actorId,
  });

  if (body.assigneeId) {
    await notifySafely(() =>
      taskNotification.notifyTaskAssigned({
        workspaceId,
        taskId: task.id,
        taskTitle: task.title,
        assigneeId: body.assigneeId as string,
        actorId,
        dueAt: task.dueAt,
        priority: task.priority,
      })
    );
  }

  await auditService.recordAuditLog({
    workspaceId,
    actorId,
    action: 'TASK_CREATED',
    targetType: 'Task',
    targetId: task.id,
    metadata: { title: task.title, priority: task.priority, assigneeId: task.assignee?.id ?? null },
  });

  return task;
};

export const getTaskBoard = async (
  workspaceId: string,
  userId: string,
  role: WorkspaceRole,
  query: BoardQuery
) => {
  const isOwner = role === 'OWNER';
  const mine = isOwner && query.mine === true;
  const assigneeId = isOwner ? (mine ? userId : undefined) : userId;
  const includeUnassigned = isOwner && !mine;

  const filters = {
    workspaceId,
    assigneeId,
    includeUnassigned,
    search: query.search,
    priority: query.priority,
  };

  const [groups, counts] = await Promise.all([
    taskRepository.findBoardTasks({ ...filters, limit: BOARD_COLUMN_LIMIT }),
    taskRepository.countBoardTasks(filters),
  ]);

  return { ...groups, counts };
};

const getTaskOrThrow = async (taskId: string, workspaceId: string) => {
  const task = await taskRepository.findTaskById(taskId, workspaceId);
  if (!task) {
    throw new NotFoundError('Công việc không tồn tại');
  }
  return task;
};

export const assignTask = async (
  workspaceId: string,
  actorId: string,
  taskId: string,
  body: AssignTaskBody
) => {
  const task = await getTaskOrThrow(taskId, workspaceId);
  const { assigneeId } = body;

  if (assigneeId) {
    await assertAssigneeIsMember(workspaceId, assigneeId);
  }

  const updated = await taskRepository.assignTask(taskId, {
    assigneeId,
    assignedById: assigneeId ? actorId : null,
    assignedAt: assigneeId ? new Date() : null,
    dueAt: assigneeId ? task.dueAt : null,
    status: assigneeId ? undefined : 'TODO',
  });

  if (assigneeId) {
    await notifySafely(() =>
      taskNotification.notifyTaskAssigned({
        workspaceId,
        taskId: updated.id,
        taskTitle: updated.title,
        assigneeId,
        actorId,
        dueAt: updated.dueAt,
        priority: updated.priority,
      })
    );
  }

  await auditService.recordAuditLog({
    workspaceId,
    actorId,
    action: assigneeId ? 'TASK_ASSIGNED' : 'TASK_UNASSIGNED',
    targetType: 'Task',
    targetId: taskId,
    metadata: { title: task.title, assigneeId },
  });

  return updated;
};

export const updateTaskStatus = async (
  workspaceId: string,
  actorId: string,
  role: WorkspaceRole,
  taskId: string,
  body: UpdateTaskStatusBody
) => {
  const task = await getTaskOrThrow(taskId, workspaceId);

  if (!task.assignee) {
    throw new ConflictError('Công việc chưa được giao cho ai');
  }

  if (role !== 'OWNER' && task.assignee.id !== actorId) {
    throw new ForbiddenError('Bạn không có quyền cập nhật công việc này');
  }

  const updated = await taskRepository.updateTaskStatus(taskId, body.status);

  await notifySafely(() =>
    taskNotification.notifyTaskStatusChanged({
      workspaceId,
      taskId: updated.id,
      taskTitle: updated.title,
      status: updated.status,
      actorId,
      actorRole: role,
      assigneeId: updated.assignee?.id ?? null,
    })
  );

  await auditService.recordAuditLog({
    workspaceId,
    actorId,
    action: 'TASK_STATUS_CHANGED',
    targetType: 'Task',
    targetId: taskId,
    metadata: { title: task.title, status: updated.status },
  });

  return updated;
};

export const updateTask = async (
  workspaceId: string,
  actorId: string,
  taskId: string,
  body: UpdateTaskBody
) => {
  const task = await getTaskOrThrow(taskId, workspaceId);
  assertDueAtValid(body.dueAt, task.dueAt);

  const updated = await taskRepository.updateTask(taskId, {
    title: body.title,
    description: body.description,
    dueAt: body.dueAt,
    priority: body.priority,
  });

  await auditService.recordAuditLog({
    workspaceId,
    actorId,
    action: 'TASK_UPDATED',
    targetType: 'Task',
    targetId: taskId,
    metadata: { title: task.title, changes: body },
  });

  return updated;
};

const assertCanManageTask = (
  role: WorkspaceRole,
  task: { assignee: { id: string } | null },
  userId: string
) => {
  if (role !== 'OWNER' && task.assignee?.id !== userId) {
    throw new ForbiddenError('Bạn không có quyền thao tác trên công việc này');
  }
};

export const linkTaskPost = async (
  workspaceId: string,
  userId: string,
  role: WorkspaceRole,
  taskId: string,
  body: LinkTaskPostBody
) => {
  const task = await getTaskOrThrow(taskId, workspaceId);
  assertCanManageTask(role, task, userId);

  if (body.postId === null) {
    const updated = await taskRepository.linkTaskPost(taskId, null);
    await auditService.recordAuditLog({
      workspaceId,
      actorId: userId,
      action: 'TASK_POST_UNLINKED',
      targetType: 'Task',
      targetId: taskId,
      metadata: { title: task.title },
    });
    return updated;
  }

  const post = await postRepository.getPostById(body.postId, workspaceId);
  if (!post) {
    throw new NotFoundError('Bài viết không tồn tại');
  }
  if (post.status === 'ARCHIVED') {
    throw new BadRequestError('Không thể gắn bài viết đã lưu trữ');
  }

  const existing = await taskRepository.findTaskByPostId(body.postId);
  if (existing && existing.id !== taskId) {
    throw new ConflictError('Bài viết đã được gắn với công việc khác');
  }

  try {
    const updated = await taskRepository.linkTaskPost(taskId, body.postId);
    await auditService.recordAuditLog({
      workspaceId,
      actorId: userId,
      action: 'TASK_POST_LINKED',
      targetType: 'Task',
      targetId: taskId,
      metadata: { title: task.title, postId: body.postId },
    });
    return updated;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictError('Bài viết đã được gắn với công việc khác');
    }
    throw error;
  }
};

export const deleteTask = async (workspaceId: string, actorId: string, taskId: string) => {
  const task = await getTaskOrThrow(taskId, workspaceId);

  await taskRepository.softDeleteTask(taskId);

  await auditService.recordAuditLog({
    workspaceId,
    actorId,
    action: 'TASK_DELETED',
    targetType: 'Task',
    targetId: taskId,
    metadata: { title: task.title },
  });
};

export default {
  createTask,
  getTaskBoard,
  updateTask,
  assignTask,
  updateTaskStatus,
  linkTaskPost,
  deleteTask,
};
