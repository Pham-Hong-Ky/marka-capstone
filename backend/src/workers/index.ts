import { Worker, type Job } from 'bullmq';
import { queueConnection } from '../config/redis.js';
import logger from '../utils/logger.js';
import { QUEUE_NAMES, type QueueName } from './types.js';
import { hasRemainingAttempts } from './queue-manager.js';

type WorkerLabel = 'ContentWorker' | 'PublishingWorker' | 'EmailWorker';

// Processor mẫu. Khi có module nghiệp vụ, thay thân hàm bằng logic thật:
// dùng `job.updateProgress()` để báo "đang xử lý" và `throw` để đánh dấu lỗi (BullMQ tự retry).
const createProcessor =
  (label: WorkerLabel) =>
  async (job: Job): Promise<{ success: boolean }> => {
    logger.info(`[${label}] job ${job.id} (${job.name}) → active`);
    await job.updateProgress(100);
    return { success: true };
  };

const attachLifecycle = (worker: Worker, label: WorkerLabel): void => {
  worker.on('progress', (job, progress) => {
    logger.debug(`[${label}] job ${job.id} tiến độ: ${JSON.stringify(progress)}`);
  });

  worker.on('completed', (job) => {
    logger.info(`[${label}] job ${job.id} → completed`);
  });

  worker.on('failed', (job, error) => {
    if (job && hasRemainingAttempts(job)) {
      logger.warn(
        `[${label}] job ${job.id} lỗi lần ${job.attemptsMade}/${job.opts.attempts ?? 1}, sẽ thử lại: ${error.message}`
      );
      return;
    }

    logger.error(`[${label}] job ${job?.id ?? '(không xác định)'} → failed hẳn: ${error.message}`);
  });

  worker.on('stalled', (jobId) => {
    logger.warn(`[${label}] job ${jobId} bị stalled, sẽ được xử lý lại`);
  });

  worker.on('error', (error) => {
    logger.error(`[${label}] lỗi worker: ${error.message}`);
  });
};

const createWorker = (queueName: QueueName, label: WorkerLabel): Worker => {
  const worker = new Worker(queueName, createProcessor(label), { connection: queueConnection });
  attachLifecycle(worker, label);
  return worker;
};

export const contentWorker = createWorker(QUEUE_NAMES.contentGeneration, 'ContentWorker');
export const publishingWorker = createWorker(QUEUE_NAMES.publishing, 'PublishingWorker');
export const emailWorker = createWorker(QUEUE_NAMES.email, 'EmailWorker');

export const closeWorkers = async (): Promise<void> => {
  await Promise.allSettled([contentWorker.close(), publishingWorker.close(), emailWorker.close()]);
};

export default { contentWorker, publishingWorker, emailWorker, closeWorkers };
