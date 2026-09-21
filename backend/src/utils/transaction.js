import prisma from '../config/db.js';
import logger from './logger.js';

/**
 * Execute operations within an ACID Database Transaction.
 * Automatically handles commit, rollback, and timeout.
 *
 * @template T
 * @param {(tx: import('@prisma/client').Prisma.TransactionClient) => Promise<T>} action
 * @param {object} [options]
 * @param {number} [options.maxWait=5000] Maximum amount of time Prisma Client will wait to acquire a transaction from the database (default: 5s)
 * @param {number} [options.timeout=10000] Maximum amount of time the transaction can run before being canceled and rolled back (default: 10s)
 * @returns {Promise<T>}
 */
export const withTransaction = async (action, options = { maxWait: 5000, timeout: 10000 }) => {
  try {
    return await prisma.$transaction(async (tx) => {
      return await action(tx);
    }, options);
  } catch (error) {
    logger.error(`❌ Transaction thất bại và đã được Rollback: ${error.message}`, {
      stack: error.stack,
    });
    throw error;
  }
};

export default withTransaction;
