import type { Job } from 'bullmq';
import { scheduleQueue } from '../../workers/queues.js';
import scheduleService from './schedule.service.js';

export const processScheduleJob = async (job: Job) => {
  if (job.name === 'schedule-due') {
    return scheduleService.processDueSchedules();
  }

  if (job.name === 'schedule-one') {
    const scheduleId = (job.data as { scheduleId?: string }).scheduleId;
    if (!scheduleId) {
      throw new Error('Job schedule-one thiếu scheduleId');
    }
    return scheduleService.publishSchedule(scheduleId);
  }

  return { success: true };
};

export const registerScheduleScheduler = async (): Promise<void> => {
  await scheduleQueue.upsertJobScheduler(
    'schedule-due',
    { every: 60_000 },
    {
      name: 'schedule-due',
      data: {},
      opts: {
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: true,
      },
    }
  );
};

export default { processScheduleJob, registerScheduleScheduler };
