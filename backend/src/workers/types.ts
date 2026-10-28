const isTest = process.env.NODE_ENV === 'test';

// Queue test dùng prefix riêng để worker production (prefix mặc định `bull`) không nhặt job của test.
export const QUEUE_PREFIX = isTest ? 'marka-test' : 'bull';

export const QUEUE_NAMES = {
  contentGeneration: 'content-generation-queue',
  schedule: 'schedule-queue',
  analytics: 'analytics-queue',
  channelMaintenance: 'channel-maintenance-queue',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export interface EnqueueResult {
  id: string;
  name: string;
  queue: QueueName;
}
