import { getErrorMessage } from './utils/errorMessage.js';
import logger from './utils/logger.js';
import prisma from './config/db.js';
import { closeRedisConnections } from './config/redis.js';
import { startWorkers, stopWorkers } from './workers/start.js';

/**
 * Entry point chạy RIÊNG cho background worker (không kèm web server).
 *
 *   Local:  npm run worker
 *   Render: New -> Background Worker -> Start Command: npm run worker
 *
 * Khi chạy kiểu này, service API nên đặt ENABLE_WORKERS=false.
 */
const main = async (): Promise<void> => {
  await startWorkers();
  logger.info('[Workers] Đang lắng nghe job... (Ctrl+C để dừng)');
};

const shutdown = async (signal: string): Promise<void> => {
  logger.info(`[Workers] Nhận tín hiệu ${signal}, đang dừng...`);
  try {
    await stopWorkers();
    await prisma.$disconnect();
    await closeRedisConnections();
    process.exit(0);
  } catch (error) {
    const message = getErrorMessage(error);
    logger.error(`[Workers] Lỗi khi dừng: ${message}`);
    process.exit(1);
  }
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

void main();
