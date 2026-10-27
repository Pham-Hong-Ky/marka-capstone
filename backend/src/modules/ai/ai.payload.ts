import type { z } from 'zod';
import { AiProviderConfigError } from './ai.errors.js';

export const parseStoredPayload = <T>(payload: string, schema: z.ZodType<T>): T => {
  try {
    return schema.parse(JSON.parse(payload) as unknown);
  } catch {
    throw new AiProviderConfigError('Dữ liệu prompt của generation không hợp lệ');
  }
};

export default { parseStoredPayload };
