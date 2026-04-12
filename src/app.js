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

app.use(helmet());
app.use(
  cors({
    origin: env.CLIENT_URL,
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

app.use('/api/v1', routes);

app.use(notFoundHandler);
app.use(errorHandler);
