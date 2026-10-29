import { Redis, RedisOptions } from 'ioredis';
import env from './env.js';

const redisUrl = env.REDIS_URL;

export const queueRedisOptions: RedisOptions = {
  maxRetriesPerRequest: null,
  retryStrategy: (times: number) => Math.min(times * 200, 2000),
};

export const queueConnection = new Redis(redisUrl, queueRedisOptions);

// Producer không được treo request khi Redis mất kết nối: giới hạn retry và
// tắt offline queue để lỗi trả về ngay thay vì giữ command vô hạn.
export const producerConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: 2,
  enableOfflineQueue: false,
  commandTimeout: 5000,
  retryStrategy: (times: number) => Math.min(times * 200, 2000),
});

export const cacheConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => Math.min(times * 200, 2000),
});

export const redis = cacheConnection;

queueConnection.on('error', (err) => {
  console.warn('⚠️ Redis [Queue] warning:', err.message);
});

producerConnection.on('error', (err) => {
  console.warn('⚠️ Redis [Producer] warning:', err.message);
});

cacheConnection.on('error', (err) => {
  console.warn('⚠️ Redis [Cache] warning:', err.message);
});

export const closeRedisConnections = async (): Promise<void> => {
  await Promise.allSettled(
    [producerConnection, queueConnection, cacheConnection].map(async (connection) => {
      if (connection.status === 'ready' || connection.status === 'connect') {
        await connection.quit();
      }
    })
  );
};

export default cacheConnection;
