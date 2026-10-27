import type { Job, JobsOptions } from 'bullmq';
import { ServiceUnavailableError } from '../utils/errors/index.js';
import { withTimeout } from '../utils/timeout.js';
import { queues } from './queues.js';
import type { EnqueueResult, QueueName } from './types.js';

const ENQUEUE_TIMEOUT_MS = 5000;

export const getQueue = (queueName: QueueName) => queues[queueName];

/** true khi job còn lượt thử lại sau lần lỗi hiện tại. */
export const hasRemainingAttempts = (job: Job): boolean => {
  return job.attemptsMade < (job.opts.attempts ?? 1);
};

export const enqueue = async (
  queueName: QueueName,
  jobName: string,
  data: unknown = {},
  options: JobsOptions = {}
): Promise<EnqueueResult> => {
  const job = await withTimeout(
    getQueue(queueName).add(jobName, data, options),
    ENQUEUE_TIMEOUT_MS,
    () => new ServiceUnavailableError('Hàng đợi tạm thời không khả dụng')
  );
  return { id: String(job.id), name: job.name, queue: queueName };
};

export const closeQueues = async (): Promise<void> => {
  await Promise.allSettled(Object.values(queues).map((queue) => queue.close()));
};

export default {
  getQueue,
  hasRemainingAttempts,
  enqueue,
  closeQueues,
};
