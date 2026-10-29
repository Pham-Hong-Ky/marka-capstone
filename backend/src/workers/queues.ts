import { Queue, type DefaultJobOptions } from 'bullmq';
import { producerConnection } from '../config/redis.js';
import { QUEUE_NAMES, QUEUE_PREFIX, type QueueName } from './types.js';

export const defaultJobOptions: DefaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  // Giữ một cửa sổ job gần đây thay vì xoá ngay, để còn đọc được trạng thái completed/failed.
  removeOnComplete: { age: 3600, count: 1000 },
  removeOnFail: { age: 24 * 3600, count: 5000 },
};

export const contentGenerationQueue = new Queue(QUEUE_NAMES.contentGeneration, {
  connection: producerConnection,
  prefix: QUEUE_PREFIX,
  defaultJobOptions,
});

export const scheduleQueue = new Queue(QUEUE_NAMES.schedule, {
  connection: producerConnection,
  prefix: QUEUE_PREFIX,
  defaultJobOptions,
});

export const analyticsQueue = new Queue(QUEUE_NAMES.analytics, {
  connection: producerConnection,
  prefix: QUEUE_PREFIX,
  defaultJobOptions,
});

export const channelMaintenanceQueue = new Queue(QUEUE_NAMES.channelMaintenance, {
  connection: producerConnection,
  prefix: QUEUE_PREFIX,
  defaultJobOptions,
});

export const taskReminderQueue = new Queue(QUEUE_NAMES.taskReminder, {
  connection: producerConnection,
  prefix: QUEUE_PREFIX,
  defaultJobOptions,
});

export const queues: Record<QueueName, Queue> = {
  [QUEUE_NAMES.contentGeneration]: contentGenerationQueue,
  [QUEUE_NAMES.schedule]: scheduleQueue,
  [QUEUE_NAMES.analytics]: analyticsQueue,
  [QUEUE_NAMES.channelMaintenance]: channelMaintenanceQueue,
  [QUEUE_NAMES.taskReminder]: taskReminderQueue,
};

export default {
  contentGenerationQueue,
  scheduleQueue,
  analyticsQueue,
  channelMaintenanceQueue,
  taskReminderQueue,
  queues,
};
