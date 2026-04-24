import mongoose from 'mongoose';

import { USER_ROLES, buildScopeFilter } from '../config/access-control.js';
import { ensureDatabaseConnection } from '../config/db.js';
import { Notification, NOTIFICATION_TYPES } from '../models/notification.model.js';
import { User } from '../models/user.model.js';
import { ApiError } from '../shared/utils/api-error.js';

const ADMIN_ROLES = [
  USER_ROLES.SUPER_ADMIN,
  USER_ROLES.DISTRICT_ADMIN,
  USER_ROLES.UPAZILA_ADMIN,
  USER_ROLES.UNION_LEADER,
  USER_ROLES.WARD_ADMIN,
];

const sanitizeNotification = (item) => ({
  id: item._id,
  recipientUserId: item.recipientUserId,
  type: item.type,
  title: item.title,
  message: item.message,
  metadata: item.metadata,
  isRead: item.isRead,
  readAt: item.readAt,
  createdAt: item.createdAt,
});

const createSystemNotifications = async (items = []) => {
  const docs = items.filter((item) => item?.recipientUserId);
  if (!docs.length) {
    return [];
  }

  const created = await Notification.insertMany(docs, { ordered: false });
  return created.map(sanitizeNotification);
};

const adminScopeQueryForBloodNeed = (bloodNeed) => {
  const location = bloodNeed.location || {};

  return {
    role: { $in: ADMIN_ROLES },
    $or: [
      { role: USER_ROLES.SUPER_ADMIN },
      { role: USER_ROLES.DISTRICT_ADMIN, districtId: location.district },
      { role: USER_ROLES.UPAZILA_ADMIN, districtId: location.district, upazilaId: location.upazila },
      { role: USER_ROLES.UNION_LEADER, districtId: location.district, upazilaId: location.upazila, unionId: location.union },
      { role: USER_ROLES.WARD_ADMIN, districtId: location.district, upazilaId: location.upazila, unionId: location.union },
    ],
  };
};

export const notificationService = {
  getMyNotifications: async (currentUser, query) => {
    await ensureDatabaseConnection('notification:getMyNotifications');

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
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  markAsRead: async (currentUser, notificationId) => {
    await ensureDatabaseConnection('notification:markAsRead');

    if (!mongoose.isValidObjectId(notificationId)) {
      throw new ApiError(400, 'Invalid notification id');
    }

    const item = await Notification.findOneAndUpdate(
      { _id: notificationId, recipientUserId: currentUser._id },
      { $set: { isRead: true, readAt: new Date() } },
      { new: true },
    );

    if (!item) {
      throw new ApiError(404, 'Notification not found');
    }

    return sanitizeNotification(item);
  },

  markAllAsRead: async (currentUser) => {
    await ensureDatabaseConnection('notification:markAllAsRead');

    const updateResult = await Notification.updateMany(
      { recipientUserId: currentUser._id, isRead: false },
      { $set: { isRead: true, readAt: new Date() } },
    );

    return { updatedCount: updateResult.modifiedCount };
  },

  createNotification: async (currentUser, payload) => {
    await ensureDatabaseConnection('notification:createNotification');

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

  notifyAdminsForBloodNeedReview: async (bloodNeed, createdByUserId) => {
    await ensureDatabaseConnection('notification:notifyAdminsForBloodNeedReview');

    const admins = await User.find(adminScopeQueryForBloodNeed(bloodNeed)).select('_id').lean();

    return createSystemNotifications(
      admins.map((admin) => ({
        recipientUserId: admin._id,
        type: NOTIFICATION_TYPES.DONATION_REQUEST,
        title: 'নতুন রক্তের অনুরোধ অনুমোদন প্রয়োজন',
        message: `${bloodNeed.patientName} এর জন্য ${bloodNeed.bloodGroup} রক্তের অনুরোধ এসেছে। যাচাই করে approve/reject করুন।`,
        metadata: {
          bloodNeedId: bloodNeed._id,
          patientName: bloodNeed.patientName,
          bloodGroup: bloodNeed.bloodGroup,
          approvalStatus: bloodNeed.approvalStatus || 'pending',
        },
        createdByUserId,
      })),
    );
  },

  notifyRequesterForBloodNeedApproval: async (bloodNeed, approvalStatus, createdByUserId) => {
    await ensureDatabaseConnection('notification:notifyRequesterForBloodNeedApproval');

    const approved = approvalStatus === 'approved';

    return createSystemNotifications([
      {
        recipientUserId: bloodNeed.userId?._id || bloodNeed.userId,
        type: NOTIFICATION_TYPES.DONATION_APPROVAL,
        title: approved ? 'রক্তের অনুরোধ অনুমোদিত হয়েছে' : 'রক্তের অনুরোধ বাতিল হয়েছে',
        message: approved
          ? `${bloodNeed.patientName} এর রক্তের অনুরোধ এখন পাবলিক তালিকায় দেখা যাবে।`
          : `${bloodNeed.patientName} এর রক্তের অনুরোধ approve করা হয়নি।`,
        metadata: {
          bloodNeedId: bloodNeed._id,
          patientName: bloodNeed.patientName,
          bloodGroup: bloodNeed.bloodGroup,
          approvalStatus,
        },
        createdByUserId,
      },
    ]);
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
