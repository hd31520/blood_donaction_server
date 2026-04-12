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

reportRouter.get(
  '/monthly/donors',
  authorizeMinimumRole(USER_ROLES.UNION_LEADER),
  authorizePermission('report:read:union'),
  getMonthlyDonorReport,
);
