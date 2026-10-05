import logger from './utils/logger.js';
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
  await stopWorkers();
  process.exit(0);
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

void main();
