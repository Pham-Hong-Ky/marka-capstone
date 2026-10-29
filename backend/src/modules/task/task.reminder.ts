import taskRepository from './task.repository.js';
import taskNotification from './task.notification.js';
import notificationRepository from '../notification/notification.repository.js';
import { addDays, getVnHour, startOfVnDay } from '../../utils/date.js';
import { getErrorMessage } from '../../utils/errorMessage.js';
import logger from '../../utils/logger.js';

export interface TaskReminderResult {
  skipped: boolean;
  dueSoon: number;
  overdue: number;
}

export const runTaskReminders = async (
  now = new Date(),
  workspaceId?: string
): Promise<TaskReminderResult> => {
  if (getVnHour(now) !== 8) {
    return { skipped: true, dueSoon: 0, overdue: 0 };
  }

  const todayStart = startOfVnDay(now);
  const tomorrowStart = addDays(todayStart, 1);
  const dayAfterStart = addDays(todayStart, 2);

  const [dueSoonTasks, overdueTasks] = await Promise.all([
    taskRepository.findDueSoonTasks(tomorrowStart, dayAfterStart, workspaceId),
    taskRepository.findOverdueTasks(todayStart, workspaceId),
  ]);

  let dueSoon = 0;
  let overdue = 0;

  for (const task of dueSoonTasks) {
    if (!task.assigneeId || !task.dueAt) continue;

    const alreadySent = await notificationRepository.hasTaskReminder({
      userId: task.assigneeId,
      type: 'TASK_DUE_SOON',
      taskId: task.id,
      dueAt: task.dueAt,
    });
    if (alreadySent) continue;

    try {
      await taskNotification.notifyTaskDueSoon(task);
      dueSoon += 1;
    } catch (error) {
      logger.warn(
        `Không gửi được nhắc hạn sắp đến hạn cho việc ${task.id}: ${getErrorMessage(error)}`
      );
    }
  }

  for (const task of overdueTasks) {
    if (!task.assigneeId || !task.dueAt) continue;

    const alreadySent = await notificationRepository.hasTaskReminder({
      userId: task.assigneeId,
      type: 'TASK_OVERDUE',
      taskId: task.id,
      dueAt: task.dueAt,
    });
    if (alreadySent) continue;

    try {
      await taskNotification.notifyTaskOverdue(task);
      overdue += 1;
    } catch (error) {
      logger.warn(`Không gửi được nhắc hạn quá hạn cho việc ${task.id}: ${getErrorMessage(error)}`);
    }
  }

  return { skipped: false, dueSoon, overdue };
};

export default { runTaskReminders };
