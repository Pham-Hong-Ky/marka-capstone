import notificationRepository from '../notification/notification.repository.js';

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

export default { notifyTaskAssigned };
