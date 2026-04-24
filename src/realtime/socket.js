import { Server } from 'socket.io';

import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

let ioInstance = null;

const parseAllowedOrigins = () => {
  if (env.CLIENT_URL === '*') {
    return '*';
  }

  return env.CLIENT_URL.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

export const initRealtimeServer = (httpServer) => {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: parseAllowedOrigins(),
      credentials: true,
    },
  });

  ioInstance.on('connection', (socket) => {
    logger.info(`Realtime client connected: ${socket.id}`);

    socket.on('analytics:join', () => {
      socket.join('analytics-dashboard');
    });

    socket.on('disconnect', () => {
      logger.info(`Realtime client disconnected: ${socket.id}`);
    });
  });

  return ioInstance;
};

export const emitAnalyticsVisit = (payload) => {
  if (!ioInstance) {
    return;
  }

  ioInstance.to('analytics-dashboard').emit('analytics:visit', payload);
};
