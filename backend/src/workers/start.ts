import logger from '../utils/logger.js';
import { queueConnection } from '../config/redis.js';
import { contentWorker, publishingWorker, emailWorker, closeWorkers } from './index.js';
import { closeQueues } from './queue-manager.js';
import { QUEUE_NAMES } from './types.js';

/**
 * Khởi động toàn bộ BullMQ worker trong TIẾN TRÌNH hiện tại.
 *
 * - Dev / máy RAM ít: chạy kèm API bằng `ENABLE_WORKERS=true` (mặc định).
 * - Production / scale: chạy RIÊNG bằng `npm run worker` và đặt
 *   `ENABLE_WORKERS=false` ở service API để API và worker scale độc lập.
 */
export const startWorkers = async (): Promise<void> => {
  logger.info(`[Workers] Đã khởi động: ${Object.values(QUEUE_NAMES).join(', ')}`);
};

export const stopWorkers = async (): Promise<void> => {
  await closeWorkers();
  await closeQueues();
  if (queueConnection.status === 'ready' || queueConnection.status === 'connect') {
    await queueConnection.quit();
  }
  logger.info('[Workers] Đã dừng toàn bộ worker an toàn.');
};

export const workers = { contentWorker, publishingWorker, emailWorker };

export default { startWorkers, stopWorkers, workers };
