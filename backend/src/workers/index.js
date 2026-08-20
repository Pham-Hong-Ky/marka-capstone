import { Worker } from 'bullmq';
import { queueConnection } from '../config/redis.js';
import logger from '../utils/logger.js';

export const contentWorker = new Worker(
  'content-generation-queue',
  async (job) => {
    logger.info(`[ContentWorker] Processing job ${job.id}`);
    return { success: true };
  },
  { connection: queueConnection }
);

export const publishingWorker = new Worker(
  'publishing-queue',
  async (job) => {
    logger.info(`[PublishingWorker] Processing job ${job.id}`);
    return { success: true };
  },
  { connection: queueConnection }
);

export const emailWorker = new Worker(
  'email-queue',
  async (job) => {
    logger.info(`[EmailWorker] Processing job ${job.id}`);
    return { success: true };
  },
  { connection: queueConnection }
);

export const closeWorkers = async () => {
  await Promise.allSettled([contentWorker.close(), publishingWorker.close(), emailWorker.close()]);
};

export default { contentWorker, publishingWorker, emailWorker, closeWorkers };
