import { ApiError } from '../shared/utils/api-error.js';
import { ROLE_LABELS, USER_ROLES, buildScopeFilter, canManageRole } from '../config/access-control.js';
import { locationService } from './location.service.js';
import { User } from '../models/user.model.js';

const sanitizeUser = (userDoc) => {
  return {
    id: userDoc._id,
    name: userDoc.name,
    email: userDoc.email,
    role: userDoc.role,
    roleLabel: ROLE_LABELS[userDoc.role],
    districtId: userDoc.districtId,
    upazilaId: userDoc.upazilaId,
    unionId: userDoc.unionId,
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
    actor.role === USER_ROLES.UNION_LEADER &&
    (String(payload.districtId) !== String(actor.districtId) ||
      String(payload.upazilaId) !== String(actor.upazilaId) ||
      String(payload.unionId) !== String(actor.unionId))
  ) {
    throw new ApiError(403, 'Union Leader can only manage their own union');
  }
};

export const userService = {
  getAllUsers: async (actor) => {
    const users = await User.find(buildScopeFilter(actor)).sort({ createdAt: -1 }).limit(200).lean();
    return users.map(sanitizeUser);
  },

  getUserById: async (userId, actor) => {
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
    const targetRole = payload.role || USER_ROLES.DONOR;

    if (!canManageRole(actor.role, targetRole)) {
      throw new ApiError(403, 'You cannot create users with equal or higher role');
    }

    const normalizedLocation = await locationService.normalizeAndValidateHierarchy({
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

    return sanitizeUser(user);
  },
};
