import mongoose from 'mongoose';

import { env } from './env.js';
import { logger } from './logger.js';

export const connectDatabase = async () => {
  try {
    await mongoose.connect(env.MONGODB_URI);
    logger.info('MongoDB connected');
  } catch (error) {
    logger.error('MongoDB connection failed', error);
    throw error;
  }
};
