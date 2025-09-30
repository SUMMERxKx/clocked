import pino from 'pino';
import { config } from '../config';

const isDevelopment = config.nodeEnv === 'development';

export const logger = pino({
  level: isDevelopment ? 'debug' : 'info',
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.email',
      'req.query.token',
      'req.params.token',
      '*.password',
      '*.token',
      '*.secret',
      '*.key',
    ],
    censor: '[REDACTED]',
  },
});

export type Logger = typeof logger;
