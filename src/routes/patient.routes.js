import { Router } from 'express';

import { listPatients, getPatientById, approvePatient, rejectPatient } from '../controllers/patient.controller.js';
import { attachCurrentUser, authenticate, authorizeMinimumRole } from '../middleware/auth.middleware.js';
import { USER_ROLES } from '../config/access-control.js';
import { requireDatabaseConnection } from '../shared/middleware/database-ready.js';

export const patientRouter = Router();

patientRouter.use(requireDatabaseConnection('patient:routes'));

// PUBLIC
patientRouter.get('/', listPatients);
patientRouter.get('/:id', getPatientById);

// PROTECTED
patientRouter.use(authenticate, attachCurrentUser);

patientRouter.get('/me', authorizeMinimumRole(USER_ROLES.DONOR), listPatients);

patientRouter.patch('/:id/approve', authorizeMinimumRole(USER_ROLES.UNION_LEADER), approvePatient);
patientRouter.patch('/:id/reject', authorizeMinimumRole(USER_ROLES.UNION_LEADER), rejectPatient);
