import { Router } from 'express';

import {
  createNotification,
  getMyNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  seedDemoNotifications,
} from '../controllers/notification.controller.js';
import {
  attachCurrentUser,
  authenticate,
  authorizeMinimumRole,
  authorizePermission,
} from '../middleware/auth.middleware.js';
import { USER_ROLES } from '../config/access-control.js';

export const notificationRouter = Router();

notificationRouter.use(authenticate, attachCurrentUser);

notificationRouter.get('/me', authorizePermission('notification:read:self'), getMyNotifications);
notificationRouter.patch('/me/read-all', authorizePermission('notification:read:self'), markAllNotificationsAsRead);
notificationRouter.patch('/me/:notificationId/read', authorizePermission('notification:read:self'), markNotificationAsRead);
notificationRouter.post('/me/seed-demo', authorizePermission('notification:read:self'), seedDemoNotifications);

notificationRouter.post(
  '/',
  authorizeMinimumRole(USER_ROLES.UNION_LEADER),
  authorizePermission('notification:create:union'),
  createNotification,
);
