import { ensureDatabaseConnection } from '../../config/db.js';
import { ApiError } from '../utils/api-error.js';

export const requireDatabaseConnection = (operation) => async (req, res, next) => {
  void req;
  void res;

  try {
    await ensureDatabaseConnection(operation);
    next();
  } catch {
    next(new ApiError(503, 'Database is temporarily unavailable. Please retry in a few seconds.'));
  }
};
