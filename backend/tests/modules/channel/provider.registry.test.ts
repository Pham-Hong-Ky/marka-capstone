import { describe, expect, it } from 'vitest';
import {
  getProvider,
  listProviders,
} from '../../../src/modules/channel/providers/provider.registry.js';

describe('provider registry', () => {
  it('trả provider Facebook', () => {
    expect(getProvider('FACEBOOK').platform).toBe('FACEBOOK');
    expect(listProviders().map((provider) => provider.platform)).toEqual([
      'FACEBOOK',
      'THREADS',
    ]);
  });

  it('báo lỗi với nền tảng chưa hỗ trợ', () => {
    expect(() => getProvider('INSTAGRAM')).toThrowError('chưa được hỗ trợ');
  });
});
