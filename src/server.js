import http from 'node:http';

import mongoose from 'mongoose';

import { app } from './app.js';
import { connectDatabase } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';

const server = http.createServer(app);

const startServer = async () => {
  try {
    await connectDatabase();

    server.listen(env.PORT, () => {
      logger.info(`Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
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
