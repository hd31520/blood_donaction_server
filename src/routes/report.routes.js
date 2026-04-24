import { Router } from 'express';

import { USER_ROLES } from '../config/access-control.js';
import { getMonthlyDonorReport, getDashboardAnalytics } from '../controllers/report.controller.js';
import {
  attachCurrentUser,
  authenticate,
  authorizeMinimumRole,
  authorizePermission,
} from '../middleware/auth.middleware.js';

export const reportRouter = Router();

reportRouter.use(authenticate, attachCurrentUser);

// NEW DASHBOARD API
reportRouter.get('/dashboard', getDashboardAnalytics);

const monthlyDonorReportMiddlewares = [
  authorizeMinimumRole(USER_ROLES.UNION_LEADER),
  authorizePermission('report:read:union'),
  getMonthlyDonorReport,
];

reportRouter.get('/monthly/donors', ...monthlyDonorReportMiddlewares);
reportRouter.get('/monthly-donor', ...monthlyDonorReportMiddlewares);
