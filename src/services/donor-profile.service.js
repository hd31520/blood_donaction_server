import mongoose from 'mongoose';

import { USER_ROLES, buildScopeFilter, isInManagedScope } from '../config/access-control.js';
import { DonorProfile } from '../models/donor-profile.model.js';
import { User } from '../models/user.model.js';
import { buildCacheKey, getOrSetCached } from '../shared/utils/query-cache.js';
import { ApiError } from '../shared/utils/api-error.js';

const DONOR_SEARCH_CACHE_TTL_MS = 60 * 1000;

const assertDonorRole = (user) => {
  if (user.role !== USER_ROLES.DONOR) {
    throw new ApiError(400, 'Donor profile is only available for donor users');
  }
};

const sanitizeDonorProfile = (profile) => {
  return {
    id: profile._id,
    userId: profile.userId,
    bloodGroup: profile.bloodGroup,
    lastDonationDate: profile.lastDonationDate,
    availabilityStatus: profile.availabilityStatus,
    donationHistory: profile.donationHistory,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
};

export const donorProfileService = {
  upsertMyProfile: async (currentUser, payload) => {
    assertDonorRole(currentUser);

    const profile = await DonorProfile.findOneAndUpdate(
      { userId: currentUser._id },
      {
        $set: {
          bloodGroup: payload.bloodGroup,
          lastDonationDate: payload.lastDonationDate || null,
          availabilityStatus: payload.availabilityStatus,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );

    return sanitizeDonorProfile(profile);
  },

  getMyProfile: async (currentUser) => {
    assertDonorRole(currentUser);

    const profile = await DonorProfile.findOne({ userId: currentUser._id });
    if (!profile) {
      throw new ApiError(404, 'Donor profile not found');
    }

    return sanitizeDonorProfile(profile);
  },

  addDonationHistoryRecord: async (currentUser, payload) => {
    assertDonorRole(currentUser);

    const profile = await DonorProfile.findOneAndUpdate(
      { userId: currentUser._id },
      {
        $setOnInsert: {
          bloodGroup: currentUser.bloodGroup,
          availabilityStatus: 'available',
        },
        $push: {
          donationHistory: {
            donationDate: payload.donationDate,
            location: payload.location,
            notes: payload.notes,
          },
        },
        $set: {
          lastDonationDate: payload.donationDate,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );

    return sanitizeDonorProfile(profile);
  },

  getMyDonationHistory: async (currentUser) => {
    assertDonorRole(currentUser);

    const profile = await DonorProfile.findOne({ userId: currentUser._id });
    if (!profile) {
      return [];
    }

    return [...profile.donationHistory].sort(
      (a, b) => new Date(b.donationDate).getTime() - new Date(a.donationDate).getTime(),
    );
  },

  getDonorProfileByUserIdForAdmin: async (currentUser, targetUserId) => {
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      throw new ApiError(404, 'Target user not found');
    }

    assertDonorRole(targetUser);

    if (!isInManagedScope(currentUser, targetUser)) {
      throw new ApiError(403, 'Target donor is out of your administrative scope');
    }

    const profile = await DonorProfile.findOne({ userId: targetUser._id });
    if (!profile) {
      throw new ApiError(404, 'Donor profile not found');
    }

    return sanitizeDonorProfile(profile);
  },

  searchDonors: async (currentUser, filters) => {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));

    const userFilter = {
      role: USER_ROLES.DONOR,
      ...buildScopeFilter(currentUser),
    };

    const objectIdFilters = [
      ['districtId', filters.districtId],
      ['upazilaId', filters.upazilaId],
      ['unionId', filters.unionId],
    ];

    objectIdFilters.forEach(([field, value]) => {
      if (!value) {
        return;
      }

      if (!mongoose.isValidObjectId(value)) {
        throw new ApiError(400, `${field} must be a valid ObjectId`);
      }

      userFilter[field] = new mongoose.Types.ObjectId(value);
    });

    const cacheKey = buildCacheKey('donor-search', {
      userId: currentUser._id,
      role: currentUser.role,
      userFilter,
      bloodGroup: filters.bloodGroup,
      availabilityStatus: filters.availabilityStatus,
      page,
      limit,
    });

    return getOrSetCached(cacheKey, DONOR_SEARCH_CACHE_TTL_MS, async () => {
      const donorUsers = await User.find(userFilter)
        .select('_id name phone location districtId upazilaId unionId')
        .lean();
      if (donorUsers.length === 0) {
        return {
          data: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
        };
      }

      const donorUserIds = donorUsers.map((user) => user._id);
      const donorUserMap = new Map(donorUsers.map((user) => [String(user._id), user]));

      const profileFilter = {
        userId: { $in: donorUserIds },
      };

      if (filters.bloodGroup) {
        profileFilter.bloodGroup = filters.bloodGroup;
      }

      if (filters.availabilityStatus) {
        profileFilter.availabilityStatus = filters.availabilityStatus;
      }

      const total = await DonorProfile.countDocuments(profileFilter);
      const profiles = await DonorProfile.find(profileFilter)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      const data = profiles.map((profile) => {
        const donorUser = donorUserMap.get(String(profile.userId));

        return {
          ...sanitizeDonorProfile(profile),
          donor: donorUser
            ? {
                name: donorUser.name,
                phone: donorUser.phone,
                location: donorUser.location,
                districtId: donorUser.districtId,
                upazilaId: donorUser.upazilaId,
                unionId: donorUser.unionId,
              }
            : null,
        };
      });

      return {
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    });
  },
};
