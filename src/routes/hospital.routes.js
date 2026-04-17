import { Router } from 'express';

import { createHospital, listHospitals } from '../controllers/hospital.controller.js';
import {
  attachCurrentUser,
  authenticate,
  authorizeMinimumRole,
  authorizeRoles,
} from '../middleware/auth.middleware.js';
import { USER_ROLES } from '../config/access-control.js';

export const hospitalRouter = Router();

hospitalRouter.use(authenticate, attachCurrentUser);

hospitalRouter.post(
  '/',
  authorizeRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.DISTRICT_ADMIN, USER_ROLES.UPAZILA_ADMIN),
  createHospital,
);

hospitalRouter.get(
  '/',
  authorizeMinimumRole(USER_ROLES.DONOR),
  listHospitals,
);
