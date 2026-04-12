import jwt from 'jsonwebtoken';

import { ROLE_LABELS, USER_ROLES } from '../config/access-control.js';
import { env } from '../config/env.js';
import { locationService } from './location.service.js';
import { ApiError } from '../shared/utils/api-error.js';
import { User } from '../models/user.model.js';

const signToken = (user) => {
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      email: user.email,
      districtId: user.districtId ? user.districtId.toString() : null,
      upazilaId: user.upazilaId ? user.upazilaId.toString() : null,
      unionId: user.unionId ? user.unionId.toString() : null,
    },
    env.JWT_SECRET,
    {
      expiresIn: env.JWT_EXPIRES_IN,
    },
  );
};

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

export const authService = {
  register: async (payload) => {
    const exists = await User.findOne({ email: payload.email });
    if (exists) {
      throw new ApiError(409, 'User with this email already exists');
    }

    const locationRefs = await locationService.normalizeAndValidateHierarchy({
      districtId: payload.districtId,
      upazilaId: payload.upazilaId,
      unionId: payload.unionId,
      role: USER_ROLES.DONOR,
    });

    const user = await User.create({
      ...payload,
      ...locationRefs,
      role: USER_ROLES.DONOR,
    });
    const token = signToken(user);

    return {
      token,
      user: sanitizeUser(user),
    };
  },

  login: async ({ email, password }) => {
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      throw new ApiError(401, 'Invalid email or password');
    }

    const passwordMatched = await user.comparePassword(password);
    if (!passwordMatched) {
      throw new ApiError(401, 'Invalid email or password');
    }

    const token = signToken(user);

    return {
      token,
      user: sanitizeUser(user),
    };
  },

  getProfile: async (userId) => {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    return sanitizeUser(user);
  },
};
