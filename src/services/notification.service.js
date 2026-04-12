import mongoose from 'mongoose';

import { buildScopeFilter } from '../config/access-control.js';
import { Notification, NOTIFICATION_TYPES } from '../models/notification.model.js';
import { User } from '../models/user.model.js';
import { ApiError } from '../shared/utils/api-error.js';

const sanitizeNotification = (item) => {
  return {
    id: item._id,
    recipientUserId: item.recipientUserId,
    type: item.type,
    title: item.title,
    message: item.message,
    metadata: item.metadata,
    isRead: item.isRead,
    readAt: item.readAt,
    createdAt: item.createdAt,
  };
};

export const notificationService = {
  getMyNotifications: async (currentUser, query) => {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));

    const filter = { recipientUserId: currentUser._id };

    if (query.unreadOnly) {
      filter.isRead = false;
    }

    if (query.type) {
      filter.type = query.type;
    }

    const total = await Notification.countDocuments(filter);
    const items = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return {
      data: items.map(sanitizeNotification),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  markAsRead: async (currentUser, notificationId) => {
    if (!mongoose.isValidObjectId(notificationId)) {
      throw new ApiError(400, 'Invalid notification id');
    }

    const item = await Notification.findOneAndUpdate(
      { _id: notificationId, recipientUserId: currentUser._id },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      },
      { new: true },
    );

    if (!item) {
      throw new ApiError(404, 'Notification not found');
    }

    return sanitizeNotification(item);
  },

  markAllAsRead: async (currentUser) => {
    const updateResult = await Notification.updateMany(
      { recipientUserId: currentUser._id, isRead: false },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      },
    );

    return {
      updatedCount: updateResult.modifiedCount,
    };
  },

  createNotification: async (currentUser, payload) => {
    const scopeFilter = buildScopeFilter(currentUser);
    const targetUser = await User.findOne({ _id: payload.recipientUserId, ...scopeFilter });

    if (!targetUser) {
      throw new ApiError(403, 'Target user is outside your administrative scope');
    }

    const item = await Notification.create({
      recipientUserId: payload.recipientUserId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      metadata: payload.metadata || {},
      createdByUserId: currentUser._id,
    });

    return sanitizeNotification(item);
  },

  seedDemoNotificationsForCurrentUser: async (currentUser) => {
    const docs = [
      {
        recipientUserId: currentUser._id,
        type: NOTIFICATION_TYPES.DONATION_REQUEST,
        title: 'Urgent Donation Request',
        message: 'A nearby hospital requested your blood group for an emergency case.',
      },
      {
        recipientUserId: currentUser._id,
        type: NOTIFICATION_TYPES.DONATION_APPROVAL,
        title: 'Donation Approved',
        message: 'Your recent donation entry has been verified by the local coordinator.',
      },
      {
        recipientUserId: currentUser._id,
        type: NOTIFICATION_TYPES.ADMIN_UPDATE,
        title: 'Admin Update',
        message: 'Monthly blood drive schedule has been updated for your area.',
      },
    ];

    const created = await Notification.insertMany(docs);
    return created.map(sanitizeNotification);
  },
};
