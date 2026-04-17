import mongoose from 'mongoose';

import { env } from './env.js';
import { logger } from './logger.js';

mongoose.set('bufferCommands', false);

let connectionPromise = null;

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

  connectionPromise = mongoose
    .connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: env.DB_CONNECT_TIMEOUT_MS,
      connectTimeoutMS: env.DB_CONNECT_TIMEOUT_MS,
      socketTimeoutMS: env.DB_CONNECT_TIMEOUT_MS,
      maxPoolSize: 10,
      minPoolSize: 1,
    })
    .then(() => {
      logger.info('MongoDB connected', {
        timeoutMs: env.DB_CONNECT_TIMEOUT_MS,
      });
      return mongoose.connection;
    })
    .catch((error) => {
      logger.error('MongoDB connection failed', {
        message: error?.message,
        timeoutMs: env.DB_CONNECT_TIMEOUT_MS,
      });
      throw error;
    })
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
