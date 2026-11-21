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
import { assertOwnerOrSelf } from '../../utils/access.js';
import { assertDueAtValid } from '../../utils/dueDate.js';
import { notifySafely as notifyWithLabel } from '../../utils/notifySafely.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../utils/errors/index.js';

const BOARD_COLUMN_LIMIT = 100;

const notifySafely = (action: () => Promise<void>) => notifyWithLabel(action, 'thông báo công việc');

const syncPostSafely = async (postId: string, data: Prisma.PostUncheckedUpdateInput) => {
  try {
    await postRepository.updateAssignmentFields(postId, data);
  } catch (error) {
    logger.warn(`Không đồng bộ được việc giao cho bài ${postId}: ${getErrorMessage(error)}`);
  }
};

export const createTask = async (workspaceId: string, actorId: string, body: CreateTaskBody) => {
  assertDueAtValid(body.dueAt);

  if (body.assigneeId) {
    await workspaceService.assertAssigneeIsMember(workspaceId, body.assigneeId);
  }

  const assignedAt = body.assigneeId ? new Date() : null;
  const task = await taskRepository.createTask({
    workspaceId,
    title: body.title,
    description: body.description ?? null,
    status: 'TODO',
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
      })
    );
  }

  await auditService.recordAuditLog({
    workspaceId,
    actorId,
    action: 'TASK_CREATED',
    targetType: 'Task',
    targetId: task.id,
    metadata: { title: task.title, assigneeId: task.assignee?.id ?? null },
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
  const viewsAll = isOwner && !mine;

  const filters = {
    workspaceId,
    assigneeId: viewsAll ? undefined : userId,
    includeUnassigned: viewsAll,
    search: query.search,
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
  const postId = task.post?.id ?? null;
  const { assigneeId } = body;

  if (assigneeId) {
    await workspaceService.assertAssigneeIsMember(workspaceId, assigneeId);
  }

  const updated = await taskRepository.assignTask(taskId, {
    assigneeId,
    assignedById: assigneeId ? actorId : null,
    assignedAt: assigneeId ? new Date() : null,
    dueAt: assigneeId ? task.dueAt : null,
    status: assigneeId ? undefined : 'TODO',
  });

  if (postId) {
    await syncPostSafely(postId, {
      assigneeId,
      assignedById: updated.assignedById,
      assignedAt: updated.assignedAt,
      dueAt: updated.dueAt,
      taskStatus: updated.status,
    });
  }

  if (assigneeId) {
    await notifySafely(() =>
      taskNotification.notifyTaskAssigned({
        workspaceId,
        taskId: updated.id,
        taskTitle: updated.title,
        assigneeId,
        actorId,
        dueAt: updated.dueAt,
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
  const postId = task.post?.id ?? null;

  if (!task.assignee) {
    throw new ConflictError('Công việc chưa được giao cho ai');
  }

  assertOwnerOrSelf(role, task.assignee.id, actorId, 'Bạn không có quyền cập nhật công việc này');

  const updated = await taskRepository.updateTaskStatus(taskId, body.status);

  if (postId) {
    await syncPostSafely(postId, { taskStatus: updated.status });
  }

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
  });

  if (task.post && body.dueAt !== undefined) {
    await syncPostSafely(task.post.id, { dueAt: updated.dueAt });
  }

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

const CLEARED_POST_ASSIGNMENT = {
  assigneeId: null,
  assignedById: null,
  assignedAt: null,
  dueAt: null,
  taskStatus: 'TODO',
} as const;

const unlinkTaskPost = async (
  workspaceId: string,
  userId: string,
  task: Awaited<ReturnType<typeof getTaskOrThrow>>
) => {
  const updated = await taskRepository.linkTaskPost(task.id, null);
  if (task.post) {
    await syncPostSafely(task.post.id, CLEARED_POST_ASSIGNMENT);
  }
  await auditService.recordAuditLog({
    workspaceId,
    actorId: userId,
    action: 'TASK_POST_UNLINKED',
    targetType: 'Task',
    targetId: task.id,
    metadata: { title: task.title },
  });
  return updated;
};

const attachTaskPost = async (
  workspaceId: string,
  userId: string,
  task: Awaited<ReturnType<typeof getTaskOrThrow>>,
  postId: string
) => {
  const post = await postRepository.getPostById(postId, workspaceId);
  if (!post) {
    throw new NotFoundError('Bài viết không tồn tại');
  }
  if (post.status === 'ARCHIVED') {
    throw new BadRequestError('Không thể gắn bài viết đã lưu trữ');
  }

  const existing = await taskRepository.findTaskByPostId(postId);
  if (existing && existing.id !== task.id) {
    throw new ConflictError('Bài viết đã được gắn với công việc khác');
  }

  try {
    const updated = await taskRepository.linkTaskPost(task.id, postId);
    await syncPostSafely(postId, {
      assigneeId: updated.assignee?.id ?? null,
      assignedById: updated.assignedById,
      assignedAt: updated.assignedAt,
      dueAt: updated.dueAt,
      taskStatus: updated.status,
    });
    await auditService.recordAuditLog({
      workspaceId,
      actorId: userId,
      action: 'TASK_POST_LINKED',
      targetType: 'Task',
      targetId: task.id,
      metadata: { title: task.title, postId },
    });
    return updated;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictError('Bài viết đã được gắn với công việc khác');
    }
    throw error;
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
  assertOwnerOrSelf(role, task.assignee?.id, userId, 'Bạn không có quyền thao tác trên công việc này');

  return body.postId === null
    ? unlinkTaskPost(workspaceId, userId, task)
    : attachTaskPost(workspaceId, userId, task, body.postId);
};

export const deleteTask = async (workspaceId: string, actorId: string, taskId: string) => {
  const task = await getTaskOrThrow(taskId, workspaceId);
  const postId = task.post?.id ?? null;

  await taskRepository.softDeleteTask(taskId);

  if (postId) {
    await syncPostSafely(postId, CLEARED_POST_ASSIGNMENT);
  }

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
