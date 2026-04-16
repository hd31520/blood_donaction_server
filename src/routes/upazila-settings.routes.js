import { Router } from 'express';

import {
  getMyUpazilaImgbbSettings,
  saveMyUpazilaImgbbSettings,
} from '../controllers/upazila-settings.controller.js';
import { attachCurrentUser, authenticate, authorizeRoles } from '../middleware/auth.middleware.js';
import { USER_ROLES } from '../config/access-control.js';

export const upazilaSettingsRouter = Router();

upazilaSettingsRouter.use(authenticate, attachCurrentUser, authorizeRoles(USER_ROLES.UPAZILA_ADMIN));

upazilaSettingsRouter.get('/imgbb', getMyUpazilaImgbbSettings);
upazilaSettingsRouter.put('/imgbb', saveMyUpazilaImgbbSettings);
