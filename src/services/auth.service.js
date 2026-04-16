import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

import { ROLE_LABELS, USER_ROLES } from '../config/access-control.js';
import { env } from '../config/env.js';
import { locationService } from './location.service.js';
import { ApiError } from '../shared/utils/api-error.js';
import { DonorProfile } from '../models/donor-profile.model.js';
import { UpazilaSettings } from '../models/upazila-settings.model.js';
import { User } from '../models/user.model.js';

const maskEmail = (email) => {
  const normalized = String(email || '').trim().toLowerCase();
  const [localPart, domainPart] = normalized.split('@');

  if (!localPart || !domainPart) {
    return normalized || 'unknown';
  }

  const head = localPart.slice(0, 2);
  return `${head}${'*'.repeat(Math.max(0, localPart.length - 2))}@${domainPart}`;
};

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
    areaType: userDoc.areaType || null,
    profileImageUrl: userDoc.profileImageUrl || null,
    locationNames: {
      division: userDoc.locationNames?.division || null,
      district: userDoc.locationNames?.district || null,
      upazila: userDoc.locationNames?.upazila || null,
      union: userDoc.locationNames?.union || null,
      wardNumber: userDoc.locationNames?.wardNumber || null,
    },
    wardNumber: userDoc.wardNumber || null,
    bloodGroup: userDoc.bloodGroup,
    location: userDoc.location,
    phone: userDoc.phone,
    createdAt: userDoc.createdAt,
  };
};

const ensureDatabaseReady = (operation) => {
  if (mongoose.connection.readyState !== 1) {
    console.error('[AUTH][DB_NOT_READY]', {
      operation,
      readyState: mongoose.connection.readyState,
      reason: 'MongoDB connection is not ready before auth query',
    });

    throw new ApiError(
      503,
      'Database is temporarily unavailable. Please retry in a few seconds.',
    );
  }
};

export const authService = {
  register: async (payload) => {
    ensureDatabaseReady('register');

    const normalizedEmail = payload.email.trim().toLowerCase();
    const safeEmail = maskEmail(normalizedEmail);

    console.info('[AUTH][REGISTER] Incoming request', {
      email: safeEmail,
      role: payload.role || USER_ROLES.DONOR,
      divisionId: payload.divisionId,
      districtId: payload.districtId,
      upazilaId: payload.upazilaId,
      areaType: payload.areaType,
      hasUnionId: Boolean(payload.unionId),
      hasUnionName: Boolean(payload.unionName),
    });

    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) {
      console.warn('[AUTH][REGISTER] Duplicate email', { email: safeEmail });
      throw new ApiError(409, 'User with this email already exists');
    }

    let locationRefs;
    try {
      locationRefs = await locationService.normalizeAndValidateHierarchy({
        divisionId: payload.divisionId,
        districtId: payload.districtId,
        upazilaId: payload.upazilaId,
        areaType: payload.areaType,
        unionId: payload.unionId,
        unionName: payload.unionName,
        wardNumber: payload.wardNumber,
        role: payload.role || USER_ROLES.DONOR,
      });
    } catch (error) {
      console.error('[AUTH][REGISTER] Location normalization failed', {
        email: safeEmail,
        reason: error?.message,
      });
      throw error;
    }

    const user = await User.create({
      ...payload,
      email: normalizedEmail,
      ...locationRefs,
      role: payload.role || USER_ROLES.DONOR,
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

    const token = signToken(user);

    console.info('[AUTH][REGISTER] Success', {
      email: safeEmail,
      userId: user._id?.toString?.() || String(user._id || ''),
      role: user.role,
    });

    return {
      token,
      user: sanitizeUser(user),
    };
  },

  login: async ({ email, password }) => {
    ensureDatabaseReady('login');

    const normalizedEmail = email.trim().toLowerCase();
    const safeEmail = maskEmail(normalizedEmail);

    console.info('[AUTH][LOGIN] Incoming request', { email: safeEmail });

    const user = await User.findOne({ email: normalizedEmail }).select('+password');
    if (!user) {
      console.warn('[AUTH][LOGIN] User not found', { email: safeEmail });
      throw new ApiError(401, 'Invalid email or password');
    }

    const passwordMatched = await user.comparePassword(password);
    if (!passwordMatched) {
      console.warn('[AUTH][LOGIN] Password mismatch', {
        email: safeEmail,
        userId: user._id?.toString?.() || String(user._id || ''),
      });
      throw new ApiError(401, 'Invalid email or password');
    }

    const token = signToken(user);

    console.info('[AUTH][LOGIN] Success', {
      email: safeEmail,
      userId: user._id?.toString?.() || String(user._id || ''),
      role: user.role,
    });

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

  updateProfile: async (userId, payload) => {
    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: payload,
      },
      { new: true },
    );

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    return sanitizeUser(user);
  },

  uploadProfileImage: async (userId, payload, actorRole) => {
    const imageValue = payload.imageDataUrl.includes(',')
      ? payload.imageDataUrl.split(',').pop()
      : payload.imageDataUrl;
    const user = await User.findById(userId).select('upazilaId');
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    let upazilaApiKey = '';
    if (user.upazilaId) {
      const settings = await UpazilaSettings.findOne({ upazilaId: user.upazilaId })
        .select('imgbbApiKey')
        .lean();
      upazilaApiKey = settings?.imgbbApiKey || '';
    }

    const canUseCustomApiKey = actorRole === USER_ROLES.UPAZILA_ADMIN;
    const customApiKey = canUseCustomApiKey ? payload.imgbbApiKey : '';
    const apiKey = customApiKey || upazilaApiKey || env.IMGBB_API_KEY;

    if (!apiKey) {
      throw new ApiError(400, 'ImgBB API key is required to upload profile image');
    }

    const formData = new FormData();
    formData.append('image', imageValue);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new ApiError(502, `ImgBB upload failed: ${errorText}`);
    }

    const data = await response.json();
    const uploadedUrl = data?.data?.display_url || data?.data?.url;
    const deleteUrl = data?.data?.delete_url || null;

    if (!uploadedUrl) {
      throw new ApiError(502, 'ImgBB upload did not return an image URL');
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          profileImageUrl: uploadedUrl,
          profileImageDeleteUrl: deleteUrl,
        },
      },
      { new: true },
    );

    if (!updatedUser) {
      throw new ApiError(404, 'User not found');
    }

    return sanitizeUser(updatedUser);
  },
};
