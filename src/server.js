import http from 'node:http';

import mongoose from 'mongoose';

import { app } from './app.js';
import { connectDatabase } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';

const server = http.createServer(app);

const startServer = async () => {
  let databaseConnected = false;

  try {
    await connectDatabase();
    databaseConnected = true;
  } catch (error) {
    logger.error('MongoDB connection failed. Starting in degraded mode', error);
  }

  server.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
    if (!databaseConnected) {
      logger.warn('Running without MongoDB connection: DB-dependent endpoints may fail');
    }
  });
};

const shutdown = async (signal) => {
  logger.warn(`${signal} received. Starting graceful shutdown...`);

  server.close(async () => {
    await mongoose.connection.close();
    logger.info('Server closed successfully');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', reason);
});

startServer();
