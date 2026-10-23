import { describe, it, expect, vi, beforeEach } from 'vitest';

const redisMock = vi.hoisted(() => ({
  setex: vi.fn(),
  getdel: vi.fn(),
  get: vi.fn(),
  del: vi.fn(),
}));

vi.mock('../../config/redis.js', () => ({ default: redisMock }));

import * as oauthStore from './channel.oauth-store.js';

const state = { userId: 'user-1', workspaceId: 'workspace-1' };

describe('channel.oauth-store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lưu state vào Redis kèm TTL 10 phút', async () => {
    redisMock.setex.mockResolvedValueOnce('OK');

    await oauthStore.saveOauthState('state-1', state);

    expect(redisMock.setex).toHaveBeenCalledWith(
      'fb:oauth:state:state-1',
      600,
      JSON.stringify(state)
    );
  });

  it('Redis từ chối lệnh ghi → 503 thay vì lỗi hệ thống 500', async () => {
    redisMock.setex.mockRejectedValueOnce(new Error('ERR max requests limit exceeded'));

    await expect(oauthStore.saveOauthState('state-1', state)).rejects.toMatchObject({
      statusCode: 503,
    });
  });

  it('đọc state đã dùng một lần rồi trả về dữ liệu', async () => {
    redisMock.getdel.mockResolvedValueOnce(JSON.stringify(state));

    await expect(oauthStore.consumeOauthState('state-1')).resolves.toEqual(state);
    expect(redisMock.getdel).toHaveBeenCalledWith('fb:oauth:state:state-1');
  });

  it('state không tồn tại → null', async () => {
    redisMock.getdel.mockResolvedValueOnce(null);

    await expect(oauthStore.consumeOauthState('missing')).resolves.toBeNull();
  });

  it('dữ liệu JSON hỏng → null thay vì lỗi', async () => {
    redisMock.get.mockResolvedValueOnce('{not-json');

    await expect(oauthStore.getOauthSession('session-1')).resolves.toBeNull();
  });

  it('Redis lỗi khi xoá session → 503', async () => {
    redisMock.del.mockRejectedValueOnce(new Error('connection lost'));

    await expect(oauthStore.deleteOauthSession('session-1')).rejects.toMatchObject({
      statusCode: 503,
    });
  });
});
