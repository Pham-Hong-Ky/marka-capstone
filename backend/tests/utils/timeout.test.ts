import { describe, expect, it } from 'vitest';
import { withTimeout } from '../../src/utils/timeout.js';

describe('withTimeout', () => {
  it('reject khi promise không settle quá hạn', async () => {
    const never = new Promise<void>(() => undefined);

    await expect(withTimeout(never, 10, () => new Error('quá hạn'))).rejects.toThrow('quá hạn');
  });

  it('trả kết quả khi promise settle trước hạn', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 100, () => new Error('quá hạn'))).resolves.toBe(
      'ok'
    );
  });
});
