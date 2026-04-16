import { StatusCodes } from 'http-status-codes';
import { ZodError } from 'zod';

import { env } from '../../config/env.js';

export const errorHandler = (err, req, res, next) => {
  void next;

  const requestContext = {
    method: req.method,
    path: req.originalUrl || req.url,
    statusCode: err?.statusCode || StatusCodes.INTERNAL_SERVER_ERROR,
    name: err?.name,
    message: err?.message,
  };

  if (err instanceof ZodError) {
    console.warn('[API][VALIDATION_ERROR]', {
      ...requestContext,
      issues: err.flatten(),
    });

    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'Validation failed',
      errors: err.flatten(),
    });
  }

  if (err?.code === 11000) {
    console.warn('[API][DUPLICATE_KEY]', {
      ...requestContext,
      keyPattern: err?.keyPattern,
      keyValue: err?.keyValue,
    });

    return res.status(StatusCodes.CONFLICT).json({
      success: false,
      message: 'Duplicate value violates unique constraint',
    });
  }

  const statusCode = err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
  const message = err.message || 'Internal server error';

  console.error('[API][ERROR]', {
    ...requestContext,
    stack: err?.stack,
    details: err?.details,
  });

  res.status(statusCode).json({
    success: false,
    message,
    ...(env.NODE_ENV !== 'production' ? { stack: err.stack } : {}),
  });
};
