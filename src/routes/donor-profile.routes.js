import { Router } from 'express';

import {
  addMyDonationHistoryRecord,
  getPublicDonorProfileByUserId,
  getDonorProfileByUserIdForAdmin,
  getMyDonationHistory,
  getMyDonorProfile,
  searchDonors,
  searchPublicDonors,
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
export const publicDonorProfileRouter = Router();

publicDonorProfileRouter.get('/public/search', searchPublicDonors);
publicDonorProfileRouter.get('/public/:userId', getPublicDonorProfileByUserId);

// Keep public endpoints on the main router as well so they always bypass auth.
donorProfileRouter.get('/public/search', searchPublicDonors);
donorProfileRouter.get('/public/:userId', getPublicDonorProfileByUserId);

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
  authorizeMinimumRole(USER_ROLES.DONOR),
  authorizePermission('donor:read:self'),
  searchDonors,
);

donorProfileRouter.get(
  '/user/:userId',
  authorizeMinimumRole(USER_ROLES.DONOR),
  authorizePermission('donor:read:self'),
  getDonorProfileByUserIdForAdmin,
);
