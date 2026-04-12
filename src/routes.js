import { Router } from 'express';

import { authRouter } from './routes/auth.routes.js';
import { healthRouter } from './modules/health/routes/health.routes.js';
import { donorProfileRouter } from './routes/donor-profile.routes.js';
import { notificationRouter } from './routes/notification.routes.js';
import { reportRouter } from './routes/report.routes.js';
import { userRouter } from './routes/user.routes.js';

export const routes = Router();

routes.use('/health', healthRouter);
routes.use('/auth', authRouter);
routes.use('/users', userRouter);
routes.use('/donor-profiles', donorProfileRouter);
routes.use('/notifications', notificationRouter);
routes.use('/reports', reportRouter);
