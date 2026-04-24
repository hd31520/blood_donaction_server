import mongoose from 'mongoose';

import { env } from './env.js';
import { logger } from './logger.js';

mongoose.set('bufferCommands', false);

let connectionPromise = null;

const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

const getConnectionOptions = () => ({
  serverSelectionTimeoutMS: env.DB_CONNECT_TIMEOUT_MS,
  connectTimeoutMS: env.DB_CONNECT_TIMEOUT_MS,
  socketTimeoutMS: env.DB_CONNECT_TIMEOUT_MS,
  maxPoolSize: 10,
  minPoolSize: 1,
});

const waitForExistingConnection = async () => {
  try {
    await mongoose.connection.asPromise();
    return mongoose.connection;
  } catch (error) {
    logger.error('MongoDB connection in-progress state failed', {
      message: error?.message,
      timeoutMs: env.DB_CONNECT_TIMEOUT_MS,
    });
    throw error;
  }
};

const connectWithRetry = async () => {
  const maxAttempts = env.DB_CONNECT_RETRIES + 1;
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      if (attempt > 1) {
        logger.info('Retrying MongoDB connection', {
          attempt,
          maxAttempts,
          timeoutMs: env.DB_CONNECT_TIMEOUT_MS,
        });
      }

      await mongoose.connect(env.MONGODB_URI, getConnectionOptions());

      logger.info('MongoDB connected', {
        attempt,
        timeoutMs: env.DB_CONNECT_TIMEOUT_MS,
      });

      return mongoose.connection;
    } catch (error) {
      lastError = error;

      logger.warn('MongoDB connection attempt failed', {
        attempt,
        maxAttempts,
        message: error?.message,
        timeoutMs: env.DB_CONNECT_TIMEOUT_MS,
      });

      if (attempt >= maxAttempts) {
        break;
      }

      await mongoose.disconnect().catch(() => {});
      await sleep(env.DB_RETRY_DELAY_MS * attempt);
    }
  }

  logger.error('MongoDB connection failed after retries', {
    attempts: maxAttempts,
    message: lastError?.message,
    timeoutMs: env.DB_CONNECT_TIMEOUT_MS,
  });

  throw lastError;
};

export const connectDatabase = async () => {
  if (mongoose.connection.readyState === 1) {
    logger.info('MongoDB already connected');
    return mongoose.connection;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  if (mongoose.connection.readyState === 2) {
    logger.info('MongoDB connection is in progress, waiting for readiness');
    connectionPromise = waitForExistingConnection().finally(() => {
      connectionPromise = null;
    });

    return connectionPromise;
  }

  connectionPromise = connectWithRetry()
    .finally(() => {
      connectionPromise = null;
    });

  return connectionPromise;
};

export const ensureDatabaseConnection = async (operation = 'unknown') => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  try {
    return await connectDatabase();
  } catch (error) {
    logger.error('MongoDB ensure connection failed', {
      operation,
      readyState: mongoose.connection.readyState,
      message: error?.message,
    });
    throw error;
  }
};
