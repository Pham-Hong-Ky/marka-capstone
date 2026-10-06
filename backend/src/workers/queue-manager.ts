import type { Job, JobsOptions } from 'bullmq';
import { queues } from './queues.js';
import type { EnqueueResult, JobStatus, QueueName, QueueStats } from './types.js';

export const getQueue = (queueName: QueueName) => queues[queueName];

/** true khi job còn lượt thử lại sau lần lỗi hiện tại. */
export const hasRemainingAttempts = (job: Job): boolean => {
  return job.attemptsMade < (job.opts.attempts ?? 1);
};

const toJobStatus = async (queueName: QueueName, job: Job): Promise<JobStatus> => {
  const state = await job.getState();
  const maxAttempts = job.opts.attempts ?? 1;

  return {
    id: String(job.id),
    name: job.name,
    queue: queueName,
    state,
    progress: job.progress,
    attemptsMade: job.attemptsMade,
    maxAttempts,
    failedReason: job.failedReason ?? null,
    result: job.returnvalue ?? null,
    createdAt: job.timestamp ?? null,
    processedAt: job.processedOn ?? null,
    finishedAt: job.finishedOn ?? null,
    isFinalFailure: state === 'failed' && !hasRemainingAttempts(job),
  };
};

export const enqueue = async (
  queueName: QueueName,
  jobName: string,
  data: unknown = {},
  options: JobsOptions = {}
): Promise<EnqueueResult> => {
  const job = await getQueue(queueName).add(jobName, data, options);
  return { id: String(job.id), name: job.name, queue: queueName };
};

export const getJobStatus = async (queueName: QueueName, jobId: string): Promise<JobStatus | null> => {
  const job = await getQueue(queueName).getJob(jobId);
  return job ? toJobStatus(queueName, job) : null;
};

/** Huỷ job chưa chạy. Job đang 'active' không huỷ được (phải dừng từ trong processor). */
export const cancelJob = async (queueName: QueueName, jobId: string): Promise<boolean> => {
  const job = await getQueue(queueName).getJob(jobId);
  if (!job) return false;

  const state = await job.getState();
  if (state === 'active') return false;

  await job.remove();
  return true;
};

/** Đưa job đã lỗi trở lại hàng đợi để chạy lại. */
export const retryJob = async (queueName: QueueName, jobId: string): Promise<boolean> => {
  const job = await getQueue(queueName).getJob(jobId);
  if (!job) return false;

  const state = await job.getState();
  if (state !== 'failed') return false;

  await job.retry();
  return true;
};

export const pauseQueue = (queueName: QueueName): Promise<void> => getQueue(queueName).pause();
export const resumeQueue = (queueName: QueueName): Promise<void> => getQueue(queueName).resume();

export const getQueueStats = async (queueName: QueueName): Promise<QueueStats> => {
  const counts = await getQueue(queueName).getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');

  return {
    waiting: counts.waiting ?? 0,
    active: counts.active ?? 0,
    completed: counts.completed ?? 0,
    failed: counts.failed ?? 0,
    delayed: counts.delayed ?? 0,
  };
};

export const closeQueues = async (): Promise<void> => {
  await Promise.allSettled(Object.values(queues).map((queue) => queue.close()));
};

export default {
  getQueue,
  hasRemainingAttempts,
  enqueue,
  getJobStatus,
  cancelJob,
  retryJob,
  pauseQueue,
  resumeQueue,
  getQueueStats,
  closeQueues,
};
