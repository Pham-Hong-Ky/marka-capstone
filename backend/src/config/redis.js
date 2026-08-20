import Redis from 'ioredis';
import env from './env.js';

const redisUrl = env.REDIS_URL;

/**
 * Connection options specifically for BullMQ.
 * BullMQ requires `maxRetriesPerRequest: null`.
 */
export const queueRedisOptions = {
  maxRetriesPerRequest: null,
  retryStrategy: (times) => Math.min(times * 200, 2000),
};

/**
 * Dedicated Redis connection instance for BullMQ queues/workers.
 */
export const queueConnection = new Redis(redisUrl, queueRedisOptions);

/**
 * Dedicated Redis connection for caching, session, rate-limiting & general queries.
 */
export const cacheConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 200, 2000),
});

// Alias for general cache usage
export const redis = cacheConnection;

queueConnection.on('error', (err) => {
  console.warn('⚠️ Redis [Queue] connection warning:', err.message);
});

cacheConnection.on('error', (err) => {
  console.warn('⚠️ Redis [Cache] connection warning:', err.message);
});

export default cacheConnection;
