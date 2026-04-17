import { ApiError } from '../shared/utils/api-error.js';
import { ensureDatabaseConnection } from '../config/db.js';
import { ROLE_LABELS, USER_ROLES, buildScopeFilter, canManageRole } from '../config/access-control.js';
import { locationService } from './location.service.js';
import { DonorProfile } from '../models/donor-profile.model.js';
import { User } from '../models/user.model.js';

const sanitizeUser = (userDoc) => {
  return {
    id: userDoc._id,
    name: userDoc.name,
    email: userDoc.email,
    role: userDoc.role,
    roleLabel: ROLE_LABELS[userDoc.role],
    profileImageUrl: userDoc.profileImageUrl || null,
    locationNames: {
      division: userDoc.locationNames?.division || null,
      district: userDoc.locationNames?.district || null,
      upazila: userDoc.locationNames?.upazila || null,
      union: userDoc.locationNames?.union || null,
    },
    bloodGroup: userDoc.bloodGroup,
    location: userDoc.location,
    phone: userDoc.phone,
    createdAt: userDoc.createdAt,
  };
};

const assertNewUserScope = (actor, payload) => {
  if (
    actor.role === USER_ROLES.DISTRICT_ADMIN &&
    String(payload.districtId) !== String(actor.districtId)
  ) {
    throw new ApiError(403, 'District Admin can only manage their own district');
  }

  if (
    actor.role === USER_ROLES.UPAZILA_ADMIN &&
    (String(payload.districtId) !== String(actor.districtId) ||
      String(payload.upazilaId) !== String(actor.upazilaId))
  ) {
    throw new ApiError(403, 'Upazila Admin can only manage their own upazila');
  }

  if (
    (actor.role === USER_ROLES.UNION_LEADER || actor.role === USER_ROLES.WARD_ADMIN) &&
    (String(payload.districtId) !== String(actor.districtId) ||
      String(payload.upazilaId) !== String(actor.upazilaId) ||
      String(payload.unionId) !== String(actor.unionId))
  ) {
    throw new ApiError(403, 'Local admin can only manage their own union or ward scope');
  }
};

export const userService = {
  getAllUsers: async (actor) => {
    await ensureDatabaseConnection('users:getAllUsers');

    const users = await User.find(buildScopeFilter(actor)).sort({ createdAt: -1 }).limit(200).lean();
    return users.map(sanitizeUser);
  },

  getUserById: async (userId, actor) => {
    await ensureDatabaseConnection('users:getUserById');

    const user = await User.findById(userId).lean();
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    const scopeFilter = buildScopeFilter(actor);
    const inScope =
      actor.role === USER_ROLES.SUPER_ADMIN ||
      Object.entries(scopeFilter).every(([key, value]) => String(user[key]) === String(value));

    if (!inScope) {
      throw new ApiError(403, 'User is out of your administrative scope');
    }

    return sanitizeUser(user);
  },

  createUserByAdmin: async (actor, payload) => {
    await ensureDatabaseConnection('users:createUserByAdmin');

    const targetRole = payload.role || USER_ROLES.DONOR;

    if (!canManageRole(actor.role, targetRole)) {
      throw new ApiError(403, 'You cannot create users with equal or higher role');
    }

    const normalizedLocation = await locationService.normalizeAndValidateHierarchy({
      divisionId: payload.divisionId,
      districtId: payload.districtId,
      upazilaId: payload.upazilaId,
      unionId: payload.unionId,
      role: targetRole,
    });

    const normalizedPayload = {
      ...payload,
      ...normalizedLocation,
    };

    assertNewUserScope(actor, normalizedPayload);

    const existing = await User.findOne({ email: payload.email });
    if (existing) {
      throw new ApiError(409, 'User with this email already exists');
    }

    const user = await User.create({
      ...normalizedPayload,
      role: targetRole,
    });

    if (user.role === USER_ROLES.DONOR) {
      await DonorProfile.findOneAndUpdate(
        { userId: user._id },
        {
          $setOnInsert: {
            bloodGroup: user.bloodGroup,
            availabilityStatus: 'available',
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }

    return sanitizeUser(user);
  },

  createUsersByAdminBulk: async (actor, users) => {
    const created = [];

    for (const payload of users) {
      const user = await userService.createUserByAdmin(actor, payload);
      created.push(user);
    }

    return created;
  },

  updateUserRoleByAdmin: async (actor, userId, payload) => {
    await ensureDatabaseConnection('users:updateUserRoleByAdmin');

    if (!canManageRole(actor.role, payload.role)) {
      throw new ApiError(403, 'You cannot assign an equal or higher role');
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      throw new ApiError(404, 'User not found');
    }

    const scopeFilter = buildScopeFilter(actor);
    const inScope =
      actor.role === USER_ROLES.SUPER_ADMIN ||
      Object.entries(scopeFilter).every(([key, value]) => String(targetUser[key]) === String(value));

    if (!inScope) {
      throw new ApiError(403, 'User is out of your administrative scope');
    }

    if (actor.role !== USER_ROLES.SUPER_ADMIN && !canManageRole(actor.role, targetUser.role)) {
      throw new ApiError(403, 'Cannot manage users at equal or higher hierarchy');
    }

    targetUser.role = payload.role;
    await targetUser.save();

    if (targetUser.role === USER_ROLES.DONOR) {
      await DonorProfile.findOneAndUpdate(
        { userId: targetUser._id },
        {
          $setOnInsert: {
            bloodGroup: targetUser.bloodGroup,
            availabilityStatus: 'available',
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }

    return sanitizeUser(targetUser.toObject());
  },
};
