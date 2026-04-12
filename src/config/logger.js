import { env } from './env.js';

const shouldLog = env.NODE_ENV !== 'test';

export const logger = {
  info: (...args) => {
    if (shouldLog) console.info('[INFO]', ...args);
  },
  warn: (...args) => {
    if (shouldLog) console.warn('[WARN]', ...args);
  },
  error: (...args) => {
    console.error('[ERROR]', ...args);
  },
};
