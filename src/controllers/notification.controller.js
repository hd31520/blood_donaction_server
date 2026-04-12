import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';

import { NOTIFICATION_TYPES } from '../models/notification.model.js';
import { notificationService } from '../services/notification.service.js';
import { asyncHandler } from '../shared/utils/async-handler.js';

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  unreadOnly: z.coerce.boolean().optional(),
  type: z.enum(Object.values(NOTIFICATION_TYPES)).optional(),
});

const createSchema = z.object({
  recipientUserId: z.string().min(1),
  type: z.enum(Object.values(NOTIFICATION_TYPES)),
  title: z.string().min(3).max(180),
  message: z.string().min(3).max(1000),
  metadata: z.record(z.any()).optional(),
});

export const getMyNotifications = asyncHandler(async (req, res) => {
  const query = listQuerySchema.parse(req.query);
  const result = await notificationService.getMyNotifications(req.currentUser, query);

  res.status(StatusCodes.OK).json({
    success: true,
    data: result.data,
    meta: result.meta,
  });
});

export const markNotificationAsRead = asyncHandler(async (req, res) => {
  const item = await notificationService.markAsRead(req.currentUser, req.params.notificationId);

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Notification marked as read',
    data: item,
  });
});

export const markAllNotificationsAsRead = asyncHandler(async (req, res) => {
  const result = await notificationService.markAllAsRead(req.currentUser);

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'All notifications marked as read',
    data: result,
  });
});

export const createNotification = asyncHandler(async (req, res) => {
  const payload = createSchema.parse(req.body);
  const item = await notificationService.createNotification(req.currentUser, payload);

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: 'Notification created successfully',
    data: item,
  });
});

export const seedDemoNotifications = asyncHandler(async (req, res) => {
  const data = await notificationService.seedDemoNotificationsForCurrentUser(req.currentUser);

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: 'Demo notifications created',
    data,
  });
});
