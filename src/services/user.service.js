import { ApiError } from '../shared/utils/api-error.js';
import { ensureDatabaseConnection } from '../config/db.js';
import mongoose from 'mongoose';
import {
  ROLE_LABELS,
  ROLE_LEVEL,
  USER_ROLES,
  buildScopeFilter,
  canManageRole,
} from '../config/access-control.js';
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

const sanitizePublicLocalAdmin = (userDoc) => {
  return {
    id: userDoc._id,
    name: userDoc.name,
    role: userDoc.role,
    roleLabel: ROLE_LABELS[userDoc.role],
    phone: userDoc.phone || null,
    areaType: userDoc.areaType || null,
    wardNumber: userDoc.wardNumber || userDoc.locationNames?.wardNumber || null,
    locationNames: {
      division: userDoc.locationNames?.division || null,
      district: userDoc.locationNames?.district || null,
      upazila: userDoc.locationNames?.upazila || null,
      union: userDoc.locationNames?.union || null,
      wardNumber: userDoc.locationNames?.wardNumber || null,
    },
  };
};

const applyObjectIdFilter = (query, field, value) => {
  if (!value) {
    return;
  }

  if (!mongoose.isValidObjectId(value)) {
    throw new ApiError(400, `${field} must be a valid ObjectId`);
  }

  query[field] = new mongoose.Types.ObjectId(value);
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

const ROLE_DESCRIPTIONS = {
  [USER_ROLES.SUPER_ADMIN]: 'সব ইউজার, রক্তদাতা, রিপোর্ট ও নোটিফিকেশন পরিচালনা।',
  [USER_ROLES.DISTRICT_ADMIN]: 'নিজ জেলার ইউজার, রক্তদাতা ও রিপোর্ট পরিচালনা।',
  [USER_ROLES.UPAZILA_ADMIN]: 'নিজ উপজেলার ইউজার, রক্তদাতা ও রিপোর্ট পরিচালনা।',
  [USER_ROLES.UNION_LEADER]: 'নিজ ইউনিয়নের রক্তদাতা ও স্থানীয় রিপোর্ট পরিচালনা।',
  [USER_ROLES.WARD_ADMIN]: 'নিজ ওয়ার্ড/ইউনিয়নের রক্তদাতা ও স্থানীয় রিপোর্ট পরিচালনা।',
  [USER_ROLES.DONOR]: 'নিজ প্রোফাইল, রক্তদানের ইতিহাস ও অনুরোধ পরিচালনা।',
  [USER_ROLES.FINDER]: 'নিজ অনুরোধ, নোটিফিকেশন ও প্রয়োজনীয় যোগাযোগ পরিচালনা।',
};

const ROLE_BADGES = {
  [USER_ROLES.SUPER_ADMIN]: 'জাতীয়',
  [USER_ROLES.DISTRICT_ADMIN]: 'জেলা',
  [USER_ROLES.UPAZILA_ADMIN]: 'উপজেলা',
  [USER_ROLES.UNION_LEADER]: 'ইউনিয়ন',
  [USER_ROLES.WARD_ADMIN]: 'ওয়ার্ড',
  [USER_ROLES.DONOR]: 'নিজ',
  [USER_ROLES.FINDER]: 'নিজ',
};

const ROLES_REQUIRING_AREA_TYPE = [
  USER_ROLES.UNION_LEADER,
  USER_ROLES.WARD_ADMIN,
  USER_ROLES.DONOR,
  USER_ROLES.FINDER,
];

const ROLES_REQUIRING_UNION = [...ROLES_REQUIRING_AREA_TYPE];

export const userService = {
  listPublicLocalAdmins: async (filters = {}) => {
    await ensureDatabaseConnection('users:listPublicLocalAdmins');

    const query = {
      role: { $in: [USER_ROLES.UNION_LEADER, USER_ROLES.WARD_ADMIN] },
      phone: { $exists: true, $nin: [null, ''] },
    };

    applyObjectIdFilter(query, 'divisionId', filters.divisionId);
    applyObjectIdFilter(query, 'districtId', filters.districtId);
    applyObjectIdFilter(query, 'upazilaId', filters.upazilaId);
    applyObjectIdFilter(query, 'unionId', filters.unionId);

    const users = await User.find(query)
      .select('_id name role phone areaType wardNumber locationNames')
      .sort({ role: 1, name: 1 })
      .limit(200)
      .lean();

    return users.map(sanitizePublicLocalAdmin);
  },

  getUserManagementMeta: async (actor) => {
    const allRoles = Object.values(USER_ROLES);
    const assignableRoles = allRoles.filter((role) => canManageRole(actor.role, role));
    const defaultCreateRole = assignableRoles.includes(USER_ROLES.DONOR)
      ? USER_ROLES.DONOR
      : assignableRoles[0] || null;

    const roles = allRoles
      .map((role) => ({
        role,
        title: ROLE_LABELS[role] || role,
        description: ROLE_DESCRIPTIONS[role] || 'Role details unavailable.',
        badge: ROLE_BADGES[role] || 'General',
        level: ROLE_LEVEL[role] || 0,
      }))
      .sort((a, b) => b.level - a.level);

    return {
      actorRole: actor.role,
      assignableRoles,
      defaultCreateRole,
      roles,
      rolesRequiringAreaType: ROLES_REQUIRING_AREA_TYPE,
      rolesRequiringUnionSelection: ROLES_REQUIRING_UNION,
    };
  },

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
      areaType: payload.areaType,
      unionId: payload.unionId,
      unionName: payload.unionName,
      wardNumber: payload.wardNumber,
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
