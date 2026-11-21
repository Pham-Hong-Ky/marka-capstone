import { getErrorMessage } from './errorMessage.js';
import logger from './logger.js';

export const notifySafely = async (action: () => Promise<void>, label = 'thông báo') => {
  try {
    await action();
  } catch (error) {
    logger.warn(`Không gửi được ${label}: ${getErrorMessage(error)}`);
  }
};

export default notifySafely;
