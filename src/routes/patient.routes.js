import { Router } from 'express';

import { listPatients } from '../controllers/patient.controller.js';
import {
  attachCurrentUser,
  authenticate,
  authorizeMinimumRole,
} from '../middleware/auth.middleware.js';
import { USER_ROLES } from '../config/access-control.js';
import { requireDatabaseConnection } from '../shared/middleware/database-ready.js';

export const patientRouter = Router();

patientRouter.use(requireDatabaseConnection('patient:routes'));

patientRouter.get('/', listPatients);

patientRouter.use(authenticate, attachCurrentUser);

patientRouter.get('/me', authorizeMinimumRole(USER_ROLES.DONOR), listPatients);
