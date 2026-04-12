import mongoose from 'mongoose';

import { env } from '../../../config/env.js';

export const getHealthStatus = (req, res) => {
  void req;

  res.status(200).json({
    success: true,
    message: 'Service is healthy',
    data: {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
      databaseState: mongoose.connection.readyState,
    },
  });
};
