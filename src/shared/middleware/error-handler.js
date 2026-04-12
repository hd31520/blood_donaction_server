import { StatusCodes } from 'http-status-codes';
import { ZodError } from 'zod';

import { env } from '../../config/env.js';

export const errorHandler = (err, req, res, next) => {
  void req;
  void next;

  if (err instanceof ZodError) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'Validation failed',
      errors: err.flatten(),
    });
  }

  if (err?.code === 11000) {
    return res.status(StatusCodes.CONFLICT).json({
      success: false,
      message: 'Duplicate value violates unique constraint',
    });
  }

  const statusCode = err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
  const message = err.message || 'Internal server error';

  res.status(statusCode).json({
    success: false,
    message,
    ...(env.NODE_ENV !== 'production' ? { stack: err.stack } : {}),
  });
};
