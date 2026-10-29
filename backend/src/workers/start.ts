import { getErrorMessage } from '../utils/errorMessage.js';
import logger from '../utils/logger.js';
import { withTimeout } from '../utils/timeout.js';
import { registerScheduleScheduler } from '../modules/schedule/schedule.processor.js';
import { registerAnalyticsScheduler } from '../modules/analytics/analytics.processor.js';
import { registerChannelScheduler } from '../modules/channel/channel.processor.js';
import { registerTaskReminderScheduler } from '../modules/task/task.reminder.processor.js';
import { registerAiRecoveryScheduler } from '../modules/ai/ai.processor.js';
import {
  analyticsWorker,
  channelWorker,
  contentWorker,
  scheduleWorker,
  taskReminderWorker,
  closeWorkers,
} from './index.js';
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
  try {
    await withTimeout(registerScheduleScheduler(), 10_000, () => new Error('Timeout đăng ký scheduler đăng bài'));
  } catch (error) {
    const message = getErrorMessage(error);
    logger.error(`[Workers] Không đăng ký được scheduler đăng bài: ${message}`);
  }
  try {
    await withTimeout(
      registerAnalyticsScheduler(),
      10_000,
      () => new Error('Timeout đăng ký scheduler đồng bộ số liệu')
    );
  } catch (error) {
    const message = getErrorMessage(error);
    logger.error(`[Workers] Không đăng ký được scheduler đồng bộ số liệu: ${message}`);
  }
  try {
    await withTimeout(
      registerChannelScheduler(),
      10_000,
      () => new Error('Timeout đăng ký scheduler gia hạn token kênh')
    );
  } catch (error) {
    const message = getErrorMessage(error);
    logger.error(`[Workers] Không đăng ký được scheduler gia hạn token kênh: ${message}`);
  }
  try {
    await withTimeout(
      registerTaskReminderScheduler(),
      10_000,
      () => new Error('Timeout đăng ký scheduler nhắc hạn công việc')
    );
  } catch (error) {
    const message = getErrorMessage(error);
    logger.error(`[Workers] Không đăng ký được scheduler nhắc hạn công việc: ${message}`);
  }
  try {
    await withTimeout(
      registerAiRecoveryScheduler(),
      10_000,
      () => new Error('Timeout đăng ký scheduler dọn tác vụ AI treo')
    );
  } catch (error) {
    const message = getErrorMessage(error);
    logger.error(`[Workers] Không đăng ký được scheduler dọn tác vụ AI treo: ${message}`);
  }
  logger.info(`[Workers] Đã khởi động: ${Object.values(QUEUE_NAMES).join(', ')}`);
};

export const stopWorkers = async (): Promise<void> => {
  await closeWorkers();
  await closeQueues();
  logger.info('[Workers] Đã dừng toàn bộ worker an toàn.');
};

export const workers = {
  contentWorker,
  scheduleWorker,
  analyticsWorker,
  channelWorker,
  taskReminderWorker,
};

export default { startWorkers, stopWorkers, workers };
