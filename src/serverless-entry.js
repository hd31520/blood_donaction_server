import { app } from './app.js';
import { connectDatabase } from './config/db.js';
import { logger } from './config/logger.js';

let databaseConnectionPromise = null;

const warmDatabaseConnection = () => {
  if (!databaseConnectionPromise) {
    databaseConnectionPromise = connectDatabase().catch((error) => {
      logger.error('MongoDB warm connection failed in serverless handler', {
        message: error?.message,
      });
    }).finally(() => {
      databaseConnectionPromise = null;
    });
  }

  return databaseConnectionPromise;
};

export const handler = async (req, res) => {
  void warmDatabaseConnection();
  return app(req, res);
};
