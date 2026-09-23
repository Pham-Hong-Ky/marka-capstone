import { Queue } from 'bullmq';
import { queueConnection } from '../config/redis.js';

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: true,
};

export const contentGenerationQueue = new Queue('content-generation-queue', {
  connection: queueConnection,
  defaultJobOptions,
});

export const publishingQueue = new Queue('publishing-queue', {
  connection: queueConnection,
  defaultJobOptions,
});

export const emailQueue = new Queue('email-queue', {
  connection: queueConnection,
  defaultJobOptions,
});

export default { contentGenerationQueue, publishingQueue, emailQueue };
