import winston from 'winston';
import env from '../config/env.js';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const formatLog = printf(({ level, message, timestamp, requestId, stack }) => {
  const req = requestId ? ` [Req: ${requestId}]` : '';
  return `${timestamp} ${level}${req}: ${message}${stack ? `\n${stack}` : ''}`;
});

export const logger = winston.createLogger({
  level: env.NODE_ENV === 'development' ? 'debug' : 'info',
  format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), errors({ stack: true })),
  transports: [
    new winston.transports.Console({
      format: env.NODE_ENV === 'development' ? combine(colorize(), formatLog) : combine(json()),
    }),
  ],
});

export const morganStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

export default logger;
