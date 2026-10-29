import type { Job } from 'bullmq';
import { taskReminderQueue } from '../../workers/queues.js';
import { runTaskReminders } from './task.reminder.js';

export const processTaskReminderJob = async (job: Job) => {
  if (job.name === 'task-due-reminder') {
    return runTaskReminders();
  }

  return { success: true };
};

export const registerTaskReminderScheduler = async (): Promise<void> => {
  await taskReminderQueue.upsertJobScheduler(
    'task-due-reminder',
    { every: 60 * 60 * 1000 },
    {
      name: 'task-due-reminder',
      data: {},
      opts: {
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: true,
      },
    }
  );
};

export default { processTaskReminderJob, registerTaskReminderScheduler };
