import notificationRepository from '../notification/notification.repository.js';
import workspaceRepository from '../workspace/workspace.repository.js';

export const notifyTaskAssigned = async (params: {
  workspaceId: string;
  taskId: string;
  taskTitle: string;
  assigneeId: string;
  actorId: string;
  dueAt: Date | null;
  priority: number;
}) => {
  const { workspaceId, taskId, taskTitle, assigneeId, actorId, dueAt, priority } = params;
  if (assigneeId === actorId) {
    return;
  }

  await notificationRepository.createNotification({
    userId: assigneeId,
    workspaceId,
    type: 'TASK_ASSIGNED',
    payload: {
      taskId,
      taskTitle,
      dueAt: dueAt?.toISOString() ?? null,
      priority,
      assignedById: actorId,
    },
  });
};

export const notifyTaskStatusChanged = async (params: {
  workspaceId: string;
  taskId: string;
  taskTitle: string;
  status: string;
  actorId: string;
  actorRole: 'OWNER' | 'CONTENT_CREATOR';
  assigneeId: string | null;
}) => {
  const { workspaceId, taskId, taskTitle, status, actorId, actorRole, assigneeId } = params;

  const recipientIds =
    actorRole === 'OWNER'
      ? assigneeId
        ? [assigneeId]
        : []
      : await workspaceRepository.findOwnerIds(workspaceId);

  const uniqueRecipientIds = [...new Set(recipientIds)].filter((id) => id !== actorId);

  await Promise.all(
    uniqueRecipientIds.map((userId) =>
      notificationRepository.createNotification({
        userId,
        workspaceId,
        type: 'TASK_STATUS_CHANGED',
        payload: { taskId, taskTitle, status, changedById: actorId },
      })
    )
  );
};

interface DeadlineTask {
  id: string;
  workspaceId: string;
  title: string;
  priority: number;
  dueAt: Date | null;
  assigneeId: string | null;
}

const notifyTaskDeadline = async (type: 'TASK_DUE_SOON' | 'TASK_OVERDUE', task: DeadlineTask) => {
  if (!task.assigneeId || !task.dueAt) {
    return;
  }

  await notificationRepository.createNotification({
    userId: task.assigneeId,
    workspaceId: task.workspaceId,
    type,
    payload: {
      taskId: task.id,
      taskTitle: task.title,
      dueAt: task.dueAt.toISOString(),
      priority: task.priority,
    },
  });
};

export const notifyTaskDueSoon = (task: DeadlineTask) => notifyTaskDeadline('TASK_DUE_SOON', task);

export const notifyTaskOverdue = (task: DeadlineTask) => notifyTaskDeadline('TASK_OVERDUE', task);

export default {
  notifyTaskAssigned,
  notifyTaskStatusChanged,
  notifyTaskDueSoon,
  notifyTaskOverdue,
};
