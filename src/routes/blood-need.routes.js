import { Router } from 'express';
import {
  createBloodNeed,
  getBloodNeedById,
  getMyBloodNeeds,
  searchBloodNeeds,
  searchBloodNeedsInScope,
  updateBloodNeed,
  addDonorToBloodNeed,
  cancelBloodNeed,
  getPublicBloodNeeds,
} from '../controllers/blood-need.controller.js';
import {
  attachCurrentUser,
  authenticate,
  authorizeMinimumRole,
  authorizePermission,
} from '../middleware/auth.middleware.js';
import { USER_ROLES } from '../config/access-control.js';

export const publicBloodNeedRouter = Router();
export const bloodNeedRouter = Router();

// Public routes - no authentication required
publicBloodNeedRouter.get('/public/search', getPublicBloodNeeds);
publicBloodNeedRouter.get('/public/:id', getBloodNeedById);

// Protected routes - authentication required
bloodNeedRouter.use(authenticate, attachCurrentUser);

// User can create blood need requests
bloodNeedRouter.post('/', authorizePermission('blood-need:create'), createBloodNeed);

// User can view their own blood needs
bloodNeedRouter.get('/me', authorizePermission('blood-need:read:self'), getMyBloodNeeds);

// Search blood needs - available to authenticated users
bloodNeedRouter.get('/search/all', searchBloodNeeds);

// Search blood needs in user scope
bloodNeedRouter.get(
  '/search/scope',
  authorizeMinimumRole(USER_ROLES.DONOR),
  searchBloodNeedsInScope,
);

// Get specific blood need
bloodNeedRouter.get('/:id', authorizePermission('blood-need:read'), getBloodNeedById);

// Update blood need - only creator or requester can update
bloodNeedRouter.put(
  '/:id',
  authorizePermission('blood-need:update:self'),
  updateBloodNeed,
);

// Add donor/volunteer to blood need
bloodNeedRouter.post('/:id/donate', authorizePermission('blood-need:donate'), addDonorToBloodNeed);

// Cancel blood need request
bloodNeedRouter.post(
  '/:id/cancel',
  authorizePermission('blood-need:cancel:self'),
  cancelBloodNeed,
);
