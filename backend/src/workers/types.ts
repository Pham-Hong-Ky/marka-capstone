import type { JobProgress, JobState as BullJobState } from 'bullmq';

export const QUEUE_NAMES = {
  contentGeneration: 'content-generation-queue',
  publishing: 'publishing-queue',
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
