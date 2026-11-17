import type { Job } from 'bullmq';
import { analyticsQueue } from '../../workers/queues.js';
import analyticsService from './analytics.service.js';

export const processAnalyticsJob = async (job: Job) => {
  if (job.name === 'analytics-sync') {
    const { workspaceId, force } = job.data as { workspaceId?: string; force?: boolean };
    return analyticsService.syncMetrics({ workspaceId, force });
  }

  return { success: true };
};

export const registerAnalyticsScheduler = async (): Promise<void> => {
  await analyticsQueue.upsertJobScheduler(
    'analytics-sync',
    { every: 60 * 60 * 1000 },
    {
      name: 'analytics-sync',
      data: {},
      opts: {
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: true,
      },
    }
  );
};

export default { processAnalyticsJob, registerAnalyticsScheduler };
