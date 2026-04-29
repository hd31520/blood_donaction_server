import { Router } from 'express';

import { USER_ROLES } from '../config/access-control.js';
import { getAdminAreaSummary, getVisitStats, trackVisit } from '../controllers/analytics.controller.js';
import { attachCurrentUser, authenticate, authorizeMinimumRole } from '../middleware/auth.middleware.js';

export const analyticsRouter = Router();

analyticsRouter.post('/track', trackVisit);

analyticsRouter.use(authenticate, attachCurrentUser);
analyticsRouter.get('/visits', authorizeMinimumRole(USER_ROLES.UNION_LEADER), getVisitStats);
analyticsRouter.get('/admin-summary', authorizeMinimumRole(USER_ROLES.UNION_LEADER), getAdminAreaSummary);
