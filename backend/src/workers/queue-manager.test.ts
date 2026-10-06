import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Job } from 'bullmq';
import { queueConnection } from '../config/redis.js';
import { QUEUE_NAMES } from './types.js';
import {
  cancelJob,
  closeQueues,
  enqueue,
  getJobStatus,
  getQueueStats,
  hasRemainingAttempts,
  pauseQueue,
  resumeQueue,
  retryJob,
} from './queue-manager.js';

const TEST_QUEUE = QUEUE_NAMES.email;

describe('Queue Manager — quản lý trạng thái job', () => {
  beforeAll(async () => {
    await queueConnection.ping();
  });

  afterAll(async () => {
    await closeQueues();
    if (queueConnection.status === 'ready' || queueConnection.status === 'connect') {
      await queueConnection.quit();
    }
  });

  it('enqueue tạo job ở trạng thái waiting và đọc được trạng thái', async () => {
    const { id } = await enqueue(TEST_QUEUE, 'test-job', { hello: 'world' });
    const status = await getJobStatus(TEST_QUEUE, id);

    expect(status).not.toBeNull();
    expect(status?.state).toBe('waiting');
    expect(status?.queue).toBe(TEST_QUEUE);
    expect(status?.attemptsMade).toBe(0);
    expect(status?.maxAttempts).toBe(3);
    expect(status?.isFinalFailure).toBe(false);

    await cancelJob(TEST_QUEUE, id);
  });

  it('getJobStatus trả null với job không tồn tại', async () => {
    expect(await getJobStatus(TEST_QUEUE, 'khong-ton-tai')).toBeNull();
  });

  it('cancelJob xoá job khỏi hàng đợi', async () => {
    const { id } = await enqueue(TEST_QUEUE, 'test-cancel', {});

    expect(await cancelJob(TEST_QUEUE, id)).toBe(true);
    expect(await getJobStatus(TEST_QUEUE, id)).toBeNull();
  });

  it('retryJob từ chối job không ở trạng thái failed', async () => {
    const { id } = await enqueue(TEST_QUEUE, 'test-retry', {});

    expect(await retryJob(TEST_QUEUE, id)).toBe(false);
    await cancelJob(TEST_QUEUE, id);
  });

  it('pauseQueue/resumeQueue hoạt động và getQueueStats trả đủ các trường', async () => {
    await pauseQueue(TEST_QUEUE);
    await resumeQueue(TEST_QUEUE);

    const stats = await getQueueStats(TEST_QUEUE);
    expect(stats).toEqual({
      waiting: expect.any(Number),
      active: expect.any(Number),
      completed: expect.any(Number),
      failed: expect.any(Number),
      delayed: expect.any(Number),
    });
  });

  it('hasRemainingAttempts phân biệt lỗi còn retry và lỗi hẳn', () => {
    const makeJob = (attemptsMade: number, attempts: number) =>
      ({ attemptsMade, opts: { attempts } }) as unknown as Job;

    expect(hasRemainingAttempts(makeJob(1, 3))).toBe(true);
    expect(hasRemainingAttempts(makeJob(3, 3))).toBe(false);
  });
});
