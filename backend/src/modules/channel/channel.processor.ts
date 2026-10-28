import type { Job } from 'bullmq';
import { channelMaintenanceQueue } from '../../workers/queues.js';
import { refreshChannelTokens } from './channel.token-refresh.js';

export const processChannelJob = async (job: Job) => {
  if (job.name === 'channel-token-refresh') {
    return refreshChannelTokens();
  }

  return { success: true };
};

export const registerChannelScheduler = async (): Promise<void> => {
  await channelMaintenanceQueue.upsertJobScheduler(
    'channel-token-refresh',
    { every: 24 * 60 * 60 * 1000 },
    {
      name: 'channel-token-refresh',
      data: {},
      opts: {
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: true,
      },
    }
  );
};

export default { processChannelJob, registerChannelScheduler };
