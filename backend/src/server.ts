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

const shutdown = async (signal: string) => {
  logger.info(`Nhận tín hiệu ${signal}. Đang đóng server...`);
  server.close(async () => {
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
