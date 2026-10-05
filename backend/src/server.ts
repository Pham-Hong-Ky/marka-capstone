import app from './app.js';
import env from './config/env.js';
import prisma from './config/db.js';
import redis from './config/redis.js';
import logger from './utils/logger.js';

const PORT = env.PORT || 5000;

const server = app.listen(PORT, () => {
  logger.info(`Marka Backend API: http://localhost:${PORT}`);
  logger.info(`Swagger Docs: http://localhost:${PORT}/api-docs`);
});

// Chỉ nạp worker khi ENABLE_WORKERS=true để API và worker có thể scale độc lập.
// Production nên đặt ENABLE_WORKERS=false và chạy `npm run worker` ở service riêng.
let stopWorkers: (() => Promise<void>) | null = null;

if (env.ENABLE_WORKERS && env.NODE_ENV !== 'test') {
  const workers = await import('./workers/start.js');
  await workers.startWorkers();
  stopWorkers = workers.stopWorkers;
  logger.info('Background workers: BẬT (chạy chung tiến trình API).');
} else {
  logger.info('Background workers: TẮT ở API (chạy riêng bằng `npm run worker`).');
}

const shutdown = async (signal: string) => {
  logger.info(`Nhận tín hiệu ${signal}. Đang đóng server...`);
  server.close(async () => {
    if (stopWorkers) await stopWorkers();
    await prisma.$disconnect();
    if (redis.status === 'ready' || redis.status === 'connect') {
      await redis.quit();
    }
    logger.info('Server đã đóng an toàn.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default server;
