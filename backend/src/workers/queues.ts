import { Queue, type DefaultJobOptions } from 'bullmq';
import { queueConnection } from '../config/redis.js';
import { QUEUE_NAMES, type QueueName } from './types.js';

export const defaultJobOptions: DefaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  // Giữ một cửa sổ job gần đây thay vì xoá ngay, để còn đọc được trạng thái completed/failed.
  removeOnComplete: { age: 3600, count: 1000 },
  removeOnFail: { age: 24 * 3600, count: 5000 },
};

export const contentGenerationQueue = new Queue(QUEUE_NAMES.contentGeneration, {
  connection: queueConnection,
  defaultJobOptions,
});

export const publishingQueue = new Queue(QUEUE_NAMES.publishing, {
  connection: queueConnection,
  defaultJobOptions,
});

export const emailQueue = new Queue(QUEUE_NAMES.email, {
  connection: queueConnection,
  defaultJobOptions,
});

export const queues: Record<QueueName, Queue> = {
  [QUEUE_NAMES.contentGeneration]: contentGenerationQueue,
  [QUEUE_NAMES.publishing]: publishingQueue,
  [QUEUE_NAMES.email]: emailQueue,
};

export default { contentGenerationQueue, publishingQueue, emailQueue, queues };
