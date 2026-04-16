import mongoose from 'mongoose';

import { env } from './env.js';
import { logger } from './logger.js';

mongoose.set('bufferCommands', false);

export const connectDatabase = async () => {
  if (mongoose.connection.readyState === 1) {
    logger.info('MongoDB already connected');
    return mongoose.connection;
  }

  try {
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: env.DB_CONNECT_TIMEOUT_MS,
      connectTimeoutMS: env.DB_CONNECT_TIMEOUT_MS,
      socketTimeoutMS: env.DB_CONNECT_TIMEOUT_MS,
      maxPoolSize: 10,
      minPoolSize: 1,
    });
    logger.info('MongoDB connected', {
      timeoutMs: env.DB_CONNECT_TIMEOUT_MS,
    });
    return mongoose.connection;
  } catch (error) {
    logger.error('MongoDB connection failed', {
      message: error?.message,
      timeoutMs: env.DB_CONNECT_TIMEOUT_MS,
    });
    throw error;
  }
};
