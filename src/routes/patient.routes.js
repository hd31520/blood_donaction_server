import { Router } from 'express';

import { listPatients } from '../controllers/patient.controller.js';
import {
  attachCurrentUser,
  authenticate,
  authorizeMinimumRole,
} from '../middleware/auth.middleware.js';
import { USER_ROLES } from '../config/access-control.js';

export const patientRouter = Router();

patientRouter.use(authenticate, attachCurrentUser);

patientRouter.get('/', authorizeMinimumRole(USER_ROLES.DONOR), listPatients);
