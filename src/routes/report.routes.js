import { Router } from 'express';

import { USER_ROLES } from '../config/access-control.js';
import { getMonthlyDonorReport } from '../controllers/report.controller.js';
import {
  attachCurrentUser,
  authenticate,
  authorizeMinimumRole,
  authorizePermission,
} from '../middleware/auth.middleware.js';

export const reportRouter = Router();

reportRouter.use(authenticate, attachCurrentUser);

const monthlyDonorReportMiddlewares = [
  authorizeMinimumRole(USER_ROLES.UNION_LEADER),
  authorizePermission('report:read:union'),
  getMonthlyDonorReport,
];

// Current canonical route
reportRouter.get('/monthly/donors', ...monthlyDonorReportMiddlewares);

// Backward-compatible route used by the frontend
reportRouter.get('/monthly-donor', ...monthlyDonorReportMiddlewares);
