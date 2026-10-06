import { Prisma } from '@prisma/client';
import prisma from '../config/db.js';
import logger from './logger.js';

export const withTransaction = async <T>(
  action: (tx: Prisma.TransactionClient) => Promise<T>,
  options: { maxWait?: number; timeout?: number } = { maxWait: 5000, timeout: 10000 }
): Promise<T> => {
  try {
    return await prisma.$transaction(async (tx) => {
      // Client đã bị mở rộng bởi Prisma extension nên kiểu tx khác Prisma.TransactionClient;
      // cast để repository dùng chung chữ ký, extension vẫn được áp dụng trong transaction.
      return await action(tx as unknown as Prisma.TransactionClient);
    }, options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    logger.error(`❌ Transaction thất bại: ${message}`, { stack });
    throw error;
  }
};

export default withTransaction;
