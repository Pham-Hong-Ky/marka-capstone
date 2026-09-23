import { Redis, RedisOptions } from 'ioredis';
import env from './env.js';

const redisUrl = env.REDIS_URL;

export const queueRedisOptions: RedisOptions = {
  maxRetriesPerRequest: null,
  retryStrategy: (times: number) => Math.min(times * 200, 2000),
};

export const queueConnection = new Redis(redisUrl, queueRedisOptions);

export const cacheConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => Math.min(times * 200, 2000),
});

export const redis = cacheConnection;

queueConnection.on('error', (err) => {
  console.warn('⚠️ Redis [Queue] warning:', err.message);
});

cacheConnection.on('error', (err) => {
  console.warn('⚠️ Redis [Cache] warning:', err.message);
});

export default cacheConnection;
