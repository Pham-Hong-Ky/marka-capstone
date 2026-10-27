import { afterAll, describe, expect, it } from 'vitest';
import {
  closeRedisConnections,
  producerConnection,
  queueConnection,
} from '../../src/config/redis.js';

describe('Redis connections', () => {
  afterAll(async () => {
    await closeRedisConnections();
  });

  it('tách producer khỏi connection dùng cho worker', () => {
    expect(producerConnection).not.toBe(queueConnection);
    expect(producerConnection.options.maxRetriesPerRequest).toBe(2);
    expect(producerConnection.options.enableOfflineQueue).toBe(false);
  });
});
