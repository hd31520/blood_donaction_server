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

const buildPublicDonorProfile = (userDoc, profileDoc) => {
  if (!userDoc) {
    return null;
  }

  return {
    id: profileDoc?._id || userDoc._id,
    userId: userDoc._id,
    name: userDoc.name,
    profileImageUrl: userDoc.profileImageUrl || null,
    bloodGroup: profileDoc?.bloodGroup || userDoc.bloodGroup || null,
    lastDonationDate: profileDoc?.lastDonationDate || null,
    availabilityStatus: profileDoc?.availabilityStatus || 'available',
    location: userDoc.location || null,
    locationNames: {
      division: userDoc.locationNames?.division || null,
      district: userDoc.locationNames?.district || null,
      upazila: userDoc.locationNames?.upazila || null,
      union: userDoc.locationNames?.union || null,
      wardNumber: userDoc.locationNames?.wardNumber || null,
    },
    donationHistory: (profileDoc?.donationHistory || []).map((entry) => ({
      donationDate: entry.donationDate,
      location: entry.location || null,
      notes: entry.notes || null,
    })),
    createdAt: profileDoc?.createdAt || userDoc.createdAt || null,
    updatedAt: profileDoc?.updatedAt || userDoc.updatedAt || null,
  };
};

const buildDonorSearchResults = (userDocs, profileDocs, filters = {}) => {
  const profileMap = new Map(profileDocs.map((profile) => [String(profile.userId), profile]));

  const data = userDocs
    .map((userDoc) => {
      const profile = profileMap.get(String(userDoc._id));

      return {
        ...(profile ? sanitizeDonorProfile(profile) : {
          id: userDoc._id,
          userId: userDoc._id,
          bloodGroup: userDoc.bloodGroup || null,
          lastDonationDate: null,
          availabilityStatus: 'available',
          donationHistory: [],
          createdAt: userDoc.createdAt || null,
          updatedAt: userDoc.updatedAt || null,
        }),
        donor: {
          name: userDoc.name,
          phone: userDoc.phone,
          location: userDoc.location,
          profileImageUrl: userDoc.profileImageUrl || null,
          locationNames: {
            division: userDoc.locationNames?.division || null,
            district: userDoc.locationNames?.district || null,
            upazila: userDoc.locationNames?.upazila || null,
            union: userDoc.locationNames?.union || null,
          },
        },
      };
    })
    .filter(Boolean)
    .filter((donor) => {
      if (filters.availabilityStatus && donor.availabilityStatus !== filters.availabilityStatus) {
        return false;
      }

      if (filters.bloodGroup && donor.bloodGroup !== filters.bloodGroup) {
        return false;
      }

      return true;
    });

  return data;
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

    // Regular donors and finders can see all donors
    // Admins see only donors in their scope
    let userFilter = {
      role: USER_ROLES.DONOR,
    };

    if (currentUser.role !== USER_ROLES.DONOR && currentUser.role !== USER_ROLES.FINDER) {
      // Apply scope filter only for admin users
      userFilter = {
        ...userFilter,
        ...buildScopeFilter(currentUser),
      };
    }

    const objectIdFilters = [
      ['divisionId', filters.divisionId],
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
        .select('_id name phone location locationNames profileImageUrl bloodGroup createdAt updatedAt')
        .sort({ createdAt: -1 })
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
      const profiles = await DonorProfile.find({ userId: { $in: donorUserIds } }).lean();
      const data = buildDonorSearchResults(donorUsers, profiles, filters);
      const total = data.length;
      const paginatedData = data.slice((page - 1) * limit, (page - 1) * limit + limit);

      return {
        data: paginatedData,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    });
  },

  searchPublicDonors: async (filters) => {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));

    const userFilter = {
      role: USER_ROLES.DONOR,
    };

    const objectIdFilters = [
      ['divisionId', filters.divisionId],
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

    const cacheKey = buildCacheKey('donor-public-search', {
      userFilter,
      bloodGroup: filters.bloodGroup,
      availabilityStatus: filters.availabilityStatus,
      page,
      limit,
    });

    return getOrSetCached(cacheKey, DONOR_SEARCH_CACHE_TTL_MS, async () => {
      const donorUsers = await User.find(userFilter)
        .select('_id name phone location locationNames profileImageUrl bloodGroup createdAt updatedAt')
        .sort({ createdAt: -1 })
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
      const profiles = await DonorProfile.find({ userId: { $in: donorUserIds } }).lean();
      const data = buildDonorSearchResults(donorUsers, profiles, filters);
      const total = data.length;
      const paginatedData = data.slice((page - 1) * limit, (page - 1) * limit + limit);

      return {
        data: paginatedData,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    });
  },

  getPublicDonorProfileByUserId: async (userId) => {
    const user = await User.findById(userId)
      .select('_id name location locationNames profileImageUrl bloodGroup createdAt updatedAt role')
      .lean();

    if (!user || user.role !== USER_ROLES.DONOR) {
      throw new ApiError(404, 'Donor profile not found');
    }

    const profile = await DonorProfile.findOne({ userId }).lean();
    return buildPublicDonorProfile(user, profile);
  },
};
