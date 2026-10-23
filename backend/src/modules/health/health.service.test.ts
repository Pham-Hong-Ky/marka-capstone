import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  ping: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
}));

vi.mock('../../config/db.js', () => ({ default: { $queryRaw: mocks.queryRaw } }));
vi.mock('../../config/redis.js', () => ({ cacheConnection: mocks }));

import { getSystemHealth } from './health.service.js';

describe('health.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queryRaw.mockResolvedValue([{ '?column?': 1 }]);
  });

  it('báo connected khi DB và Redis đều ghi được', async () => {
    mocks.ping.mockResolvedValueOnce('PONG');
    mocks.set.mockResolvedValueOnce('OK');
    mocks.del.mockResolvedValueOnce(1);

    const health = await getSystemHealth();

    expect(health.database).toBe('connected');
    expect(health.redis).toBe('connected');
    expect(mocks.set).toHaveBeenCalled();
  });

  it('báo read-only khi PING được nhưng không ghi được (hết hạn mức/quyền)', async () => {
    mocks.ping.mockResolvedValueOnce('PONG');
    mocks.set.mockRejectedValueOnce(new Error('ERR max requests limit exceeded'));

    const health = await getSystemHealth();

    expect(health.redis).toBe('read-only');
  });

  it('báo error khi không kết nối được Redis', async () => {
    mocks.ping.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));

    const health = await getSystemHealth();

    expect(health.redis).toBe('error');
    expect(mocks.set).not.toHaveBeenCalled();
  });
});
