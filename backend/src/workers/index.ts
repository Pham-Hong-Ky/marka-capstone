import { UnrecoverableError, Worker, type Job } from 'bullmq';
import { queueConnection } from '../config/redis.js';
import logger from '../utils/logger.js';
import { processScheduleJob } from '../modules/schedule/schedule.processor.js';
import { buildAiFailureMessage, processContentJob } from '../modules/ai/ai.processor.js';
import aiService from '../modules/ai/ai.service.js';
import { QUEUE_NAMES, QUEUE_PREFIX, type QueueName } from './types.js';
import { hasRemainingAttempts } from './queue-manager.js';

type WorkerLabel = 'ContentWorker' | 'ScheduleWorker' | 'EmailWorker';

// Processor mẫu. Khi có module nghiệp vụ, thay thân hàm bằng logic thật:
// dùng `job.updateProgress()` để báo "đang xử lý" và `throw` để đánh dấu lỗi (BullMQ tự retry).
const createProcessor =
  (label: WorkerLabel) =>
  async (job: Job): Promise<{ success: boolean }> => {
    logger.info(`[${label}] job ${job.id} (${job.name}) → active`);
    await job.updateProgress(100);
    return { success: true };
  };

const isUnrecoverableError = (error: Error): boolean =>
  error instanceof UnrecoverableError || error.name === 'UnrecoverableError';

const attachLifecycle = (
  worker: Worker,
  label: WorkerLabel,
  onFinalFailure?: (job: Job, error: Error) => Promise<void>
): void => {
  worker.on('progress', (job, progress) => {
    logger.debug(`[${label}] job ${job.id} tiến độ: ${JSON.stringify(progress)}`);
  });

  worker.on('completed', (job) => {
    logger.info(`[${label}] job ${job.id} → completed`);
  });

  worker.on('failed', (job, error) => {
    const isFinalFailure = !job || !hasRemainingAttempts(job) || isUnrecoverableError(error);

    if (job && !isFinalFailure) {
      logger.warn(
        `[${label}] job ${job.id} lỗi lần ${job.attemptsMade}/${job.opts.attempts ?? 1}, sẽ thử lại: ${error.message}`
      );
      return;
    }

    logger.error(`[${label}] job ${job?.id ?? '(không xác định)'} → failed hẳn: ${error.message}`);

    if (job && onFinalFailure) {
      void onFinalFailure(job, error).catch((handlerError: unknown) => {
        const message = handlerError instanceof Error ? handlerError.message : String(handlerError);
        logger.error(`[${label}] không xử lý được final failure của job ${job.id}: ${message}`);
      });
    }
  });

  worker.on('stalled', (jobId) => {
    logger.warn(`[${label}] job ${jobId} bị stalled, sẽ được xử lý lại`);
  });

  worker.on('error', (error) => {
    logger.error(`[${label}] lỗi worker: ${error.message}`);
  });
};

const createWorker = (
  queueName: QueueName,
  label: WorkerLabel,
  processor: (job: Job) => Promise<unknown> = createProcessor(label),
  onFinalFailure?: (job: Job, error: Error) => Promise<void>
): Worker => {
  const worker = new Worker(queueName, processor, {
    connection: queueConnection,
    prefix: QUEUE_PREFIX,
  });
  attachLifecycle(worker, label, onFinalFailure);
  return worker;
};

const handleAiFinalFailure = async (job: Job, error: Error) => {
  const generationId = (job.data as { generationId?: string }).generationId;
  if (!generationId) {
    logger.error(`[ContentWorker] job ${job.id} thất bại nhưng thiếu generationId`);
    return;
  }

  const message = buildAiFailureMessage(job.name === 'ai:image' ? 'IMAGE' : 'TEXT', error);
  await aiService.failGeneration(generationId, message);
};

export const contentWorker = createWorker(
  QUEUE_NAMES.contentGeneration,
  'ContentWorker',
  processContentJob,
  handleAiFinalFailure
);
export const scheduleWorker = createWorker(
  QUEUE_NAMES.schedule,
  'ScheduleWorker',
  processScheduleJob
);
export const emailWorker = createWorker(QUEUE_NAMES.email, 'EmailWorker');

export const closeWorkers = async (): Promise<void> => {
  await Promise.allSettled([contentWorker.close(), scheduleWorker.close(), emailWorker.close()]);
};

export default { contentWorker, scheduleWorker, emailWorker, closeWorkers };
