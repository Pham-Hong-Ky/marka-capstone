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

export default { notifyTaskAssigned, notifyTaskStatusChanged };
