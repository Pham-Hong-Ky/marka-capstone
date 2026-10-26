import type { JobProgress, JobState as BullJobState } from 'bullmq';

const isTest = process.env.NODE_ENV === 'test';

// Queue test dùng prefix riêng để worker production (prefix mặc định `bull`) không nhặt job của test.
export const QUEUE_PREFIX = isTest ? 'marka-test' : 'bull';

export const QUEUE_NAMES = {
  contentGeneration: 'content-generation-queue',
  schedule: 'schedule-queue',
  analytics: 'analytics-queue',
  email: 'email-queue',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/** Trạng thái job do BullMQ quản lý; 'unknown' khi job không còn trong Redis. */
export type JobState = BullJobState | 'unknown';

export interface JobStatus {
  id: string;
  name: string;
  queue: QueueName;
  state: JobState;
  progress: JobProgress;
  attemptsMade: number;
  maxAttempts: number;
  failedReason: string | null;
  result: unknown;
  createdAt: number | null;
  processedAt: number | null;
  finishedAt: number | null;
  /** true khi job đã lỗi và không còn lượt thử lại. */
  isFinalFailure: boolean;
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

export interface EnqueueResult {
  id: string;
  name: string;
  queue: QueueName;
}
