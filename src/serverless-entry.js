import { app } from './app.js';
import { connectDatabase } from './config/db.js';

let databaseConnectionPromise = null;

const ensureDatabaseConnection = async () => {
  if (!databaseConnectionPromise) {
    databaseConnectionPromise = connectDatabase().catch((error) => {
      databaseConnectionPromise = null;
      throw error;
    });
  }

  return databaseConnectionPromise;
};

export const handler = async (req, res) => {
  await ensureDatabaseConnection();
  return app(req, res);
};
