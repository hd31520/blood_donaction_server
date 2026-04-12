import mongoose from 'mongoose';

import { USER_ROLES } from '../config/access-control.js';
import { District } from '../models/district.model.js';
import { Union } from '../models/union.model.js';
import { Upazila } from '../models/upazila.model.js';
import { ApiError } from '../shared/utils/api-error.js';

const toObjectId = (value, fieldName) => {
  if (!value) {
    return null;
  }

  if (!mongoose.isValidObjectId(value)) {
    throw new ApiError(400, `${fieldName} must be a valid ObjectId`);
  }

  return new mongoose.Types.ObjectId(value);
};

export const locationService = {
  normalizeAndValidateHierarchy: async ({ districtId, upazilaId, unionId, role }) => {
    let normalizedDistrictId = toObjectId(districtId, 'districtId');
    let normalizedUpazilaId = toObjectId(upazilaId, 'upazilaId');
    let normalizedUnionId = toObjectId(unionId, 'unionId');

    if (normalizedUnionId) {
      const union = await Union.findById(normalizedUnionId);
      if (!union) {
        throw new ApiError(400, 'unionId does not exist');
      }

      normalizedUpazilaId = normalizedUpazilaId || union.upazilaId;
      normalizedDistrictId = normalizedDistrictId || union.districtId;

      if (String(union.upazilaId) !== String(normalizedUpazilaId)) {
        throw new ApiError(400, 'unionId does not belong to upazilaId');
      }

      if (String(union.districtId) !== String(normalizedDistrictId)) {
        throw new ApiError(400, 'unionId does not belong to districtId');
      }
    }

    if (normalizedUpazilaId) {
      const upazila = await Upazila.findById(normalizedUpazilaId);
      if (!upazila) {
        throw new ApiError(400, 'upazilaId does not exist');
      }

      normalizedDistrictId = normalizedDistrictId || upazila.districtId;

      if (String(upazila.districtId) !== String(normalizedDistrictId)) {
        throw new ApiError(400, 'upazilaId does not belong to districtId');
      }
    }

    if (normalizedDistrictId) {
      const district = await District.findById(normalizedDistrictId);
      if (!district) {
        throw new ApiError(400, 'districtId does not exist');
      }
    }

    if (role === USER_ROLES.DISTRICT_ADMIN && !normalizedDistrictId) {
      throw new ApiError(400, 'districtId is required for District Admin');
    }

    if (role === USER_ROLES.UPAZILA_ADMIN && (!normalizedDistrictId || !normalizedUpazilaId)) {
      throw new ApiError(400, 'districtId and upazilaId are required for Upazila Admin');
    }

    if (
      (role === USER_ROLES.UNION_LEADER || role === USER_ROLES.DONOR) &&
      (!normalizedDistrictId || !normalizedUpazilaId || !normalizedUnionId)
    ) {
      throw new ApiError(400, 'districtId, upazilaId, and unionId are required for this role');
    }

    return {
      districtId: normalizedDistrictId,
      upazilaId: normalizedUpazilaId,
      unionId: normalizedUnionId,
    };
  },
};
