import { Router } from 'express';

import {
  addMyDonationHistoryRecord,
  getDonorProfileByUserIdForAdmin,
  getMyDonationHistory,
  getMyDonorProfile,
  searchDonors,
  upsertMyDonorProfile,
} from '../controllers/donor-profile.controller.js';
import {
  attachCurrentUser,
  authenticate,
  authorizeMinimumRole,
  authorizePermission,
} from '../middleware/auth.middleware.js';
import { USER_ROLES } from '../config/access-control.js';

export const donorProfileRouter = Router();

donorProfileRouter.use(authenticate, attachCurrentUser);

donorProfileRouter.get('/me', authorizePermission('donor:read:self'), getMyDonorProfile);
donorProfileRouter.put('/me', authorizePermission('donor:update:self'), upsertMyDonorProfile);
donorProfileRouter.post(
  '/me/history',
  authorizePermission('donor:history:self'),
  addMyDonationHistoryRecord,
);
donorProfileRouter.get('/me/history', authorizePermission('donor:history:self'), getMyDonationHistory);

donorProfileRouter.get(
  '/search',
  authorizeMinimumRole(USER_ROLES.UNION_LEADER),
  authorizePermission('donor:read:union'),
  searchDonors,
);

donorProfileRouter.get(
  '/user/:userId',
  authorizeMinimumRole(USER_ROLES.UNION_LEADER),
  authorizePermission('donor:read:union'),
  getDonorProfileByUserIdForAdmin,
);
