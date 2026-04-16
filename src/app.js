import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import mongoSanitize from 'express-mongo-sanitize';
import helmet from 'helmet';
import hpp from 'hpp';
import morgan from 'morgan';

import { env } from './config/env.js';
import { errorHandler } from './shared/middleware/error-handler.js';
import { notFoundHandler } from './shared/middleware/not-found-handler.js';
import { apiLimiter } from './shared/middleware/rate-limiter.js';
import { routes } from './routes.js';

export const app = express();

const buildAllowedOrigins = () => {
  if (env.CLIENT_URL === '*') {
    return '*';
  }

  const configuredOrigins = env.CLIENT_URL.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const defaultDevOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
    'http://localhost:8080',
    'http://127.0.0.1:8080',
  ];

  // Add Vercel deployment origins for both exact and common variations
  const vercelOrigins = [
    'https://blood-donaction-clint.vercel.app',
    'https://blood-donaction-client.vercel.app',
    'https://blood-donaction.vercel.app',
  ];

  const normalizedOrigins = new Set([
    ...configuredOrigins,
    ...defaultDevOrigins,
    ...(env.NODE_ENV === 'production' ? vercelOrigins : []),
  ]);

  for (const origin of [...normalizedOrigins]) {
    try {
      const parsed = new URL(origin);
      const swapHost = parsed.hostname === 'localhost' ? '127.0.0.1' : parsed.hostname === '127.0.0.1' ? 'localhost' : null;

      if (swapHost) {
        normalizedOrigins.add(`${parsed.protocol}//${swapHost}${parsed.port ? `:${parsed.port}` : ''}`);
      }
    } catch {
      // Ignore invalid custom origins so a bad value does not crash startup.
    }
  }

  return normalizedOrigins;
};

const allowedOrigins = buildAllowedOrigins();

const isProjectVercelOrigin = (origin) => {
  try {
    const { hostname, protocol } = new URL(origin);
    if (!['http:', 'https:'].includes(protocol)) {
      return false;
    }

    return hostname.endsWith('.vercel.app') && hostname.includes('blood-donaction');
  } catch {
    return false;
  }
};

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins === '*') {
        callback(null, true);
        return;
      }

      if (isProjectVercelOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(null, allowedOrigins.has(origin));
    },
    credentials: true,
  }),
);
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(mongoSanitize());
app.use(hpp());
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(apiLimiter);

app.get('/', (req, res) => {
  void req;

  res.status(200).json({
    success: true,
    message: 'Bangla Blood API is running',
    docs: '/api/v1/health',
  });
});

app.get('/api/v1', (req, res) => {
  void req;

  res.status(200).json({
    success: true,
    message: 'Bangla Blood API v1',
    health: '/api/v1/health',
  });
});

app.use('/api/v1', routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
