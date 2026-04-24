import mongoose from 'mongoose';

import { env } from '../../../config/env.js';

const DATABASE_STATE_LABELS = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

export const getHealthStatus = (req, res) => {
  void req;

  res.status(200).json({
    success: true,
    message: 'Service is healthy',
    data: {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
      database: {
        state: DATABASE_STATE_LABELS[mongoose.connection.readyState] || 'unknown',
        readyState: mongoose.connection.readyState,
      },
    },
  });
};
