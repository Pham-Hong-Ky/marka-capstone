import { afterAll, describe, expect, it } from 'vitest';
import type { Job } from 'bullmq';
import { closeQueues, hasRemainingAttempts } from '../../src/workers/queue-manager.js';

describe('Queue Manager', () => {
  afterAll(async () => {
    await closeQueues();
  });

  it('hasRemainingAttempts phân biệt lỗi còn retry và lỗi hẳn', () => {
    const makeJob = (attemptsMade: number, attempts: number) =>
      ({ attemptsMade, opts: { attempts } }) as unknown as Job;

    expect(hasRemainingAttempts(makeJob(1, 3))).toBe(true);
    expect(hasRemainingAttempts(makeJob(3, 3))).toBe(false);
  });
});
