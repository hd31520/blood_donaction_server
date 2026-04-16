import mongoose from 'mongoose';

import { USER_ROLES } from '../config/access-control.js';
import { Division } from '../models/division.model.js';
import { District } from '../models/district.model.js';
import { Union } from '../models/union.model.js';
import { Upazila } from '../models/upazila.model.js';
import { ApiError } from '../shared/utils/api-error.js';

const toExternalId = (value) => {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    return Number.parseInt(value.trim(), 10);
  }

  return null;
};

const resolveObjectId = async (Model, value, fieldName) => {
  if (!value) {
    return null;
  }

  if (!mongoose.isValidObjectId(value)) {
    const externalId = toExternalId(value);
    if (externalId === null) {
      throw new ApiError(400, `${fieldName} must be a valid ObjectId or numeric externalId`);
    }

    const entity = await Model.findOne({ externalId }).select('_id').lean();
    if (!entity?._id) {
      throw new ApiError(400, `${fieldName} does not exist`);
    }

    return new mongoose.Types.ObjectId(entity._id);
  }

  return new mongoose.Types.ObjectId(value);
};

const normalizeText = (value) => value?.toString().trim() || null;

export const locationService = {
  normalizeAndValidateHierarchy: async ({
    divisionId,
    districtId,
    upazilaId,
    areaType,
    unionId,
    unionName,
    wardNumber,
    role,
  }) => {
    let normalizedDivisionId = await resolveObjectId(Division, divisionId, 'divisionId');
    let normalizedDistrictId = await resolveObjectId(District, districtId, 'districtId');
    let normalizedUpazilaId = await resolveObjectId(Upazila, upazilaId, 'upazilaId');
    let normalizedUnionId = await resolveObjectId(Union, unionId, 'unionId');

    let resolvedDivision = null;
    let resolvedDistrict = null;
    let resolvedUpazila = null;
    let resolvedUnion = null;
    let normalizedAreaType = areaType || null;
    const normalizedWardNumber = normalizeText(wardNumber);

    if (normalizedUnionId) {
      const union = await Union.findById(normalizedUnionId).select(
        '_id name districtId upazilaId divisionId areaType',
      );
      if (!union) {
        throw new ApiError(400, 'unionId does not exist');
      }

      resolvedUnion = union;
      const unionAreaType = union.areaType || 'union';
      normalizedAreaType = normalizedAreaType || unionAreaType;
      normalizedUpazilaId = normalizedUpazilaId || union.upazilaId;
      normalizedDistrictId = normalizedDistrictId || union.districtId;
      normalizedDivisionId = normalizedDivisionId || union.divisionId;

      if (normalizedAreaType !== unionAreaType) {
        throw new ApiError(400, 'unionId does not belong to selected areaType');
      }

      if (String(union.upazilaId) !== String(normalizedUpazilaId)) {
        throw new ApiError(400, 'unionId does not belong to upazilaId');
      }

      if (String(union.districtId) !== String(normalizedDistrictId)) {
        throw new ApiError(400, 'unionId does not belong to districtId');
      }

      if (String(union.divisionId) !== String(normalizedDivisionId)) {
        throw new ApiError(400, 'unionId does not belong to divisionId');
      }
    }

    if (normalizedUpazilaId) {
      const upazila = await Upazila.findById(normalizedUpazilaId).select(
        '_id name districtId divisionId',
      );
      if (!upazila) {
        throw new ApiError(400, 'upazilaId does not exist');
      }

      resolvedUpazila = upazila;
      normalizedDistrictId = normalizedDistrictId || upazila.districtId;
      normalizedDivisionId = normalizedDivisionId || upazila.divisionId;

      if (String(upazila.districtId) !== String(normalizedDistrictId)) {
        throw new ApiError(400, 'upazilaId does not belong to districtId');
      }

      if (String(upazila.divisionId) !== String(normalizedDivisionId)) {
        throw new ApiError(400, 'upazilaId does not belong to divisionId');
      }
    }

    if (normalizedDistrictId) {
      const district = await District.findById(normalizedDistrictId).select('_id name divisionId');
      if (!district) {
        throw new ApiError(400, 'districtId does not exist');
      }

      resolvedDistrict = district;
      normalizedDivisionId = normalizedDivisionId || district.divisionId;

      if (String(district.divisionId) !== String(normalizedDivisionId)) {
        throw new ApiError(400, 'districtId does not belong to divisionId');
      }
    }

    if (normalizedDivisionId) {
      const division = await Division.findById(normalizedDivisionId).select('_id name');
      if (!division) {
        throw new ApiError(400, 'divisionId does not exist');
      }

      resolvedDivision = division;
    }

    if (role === USER_ROLES.DISTRICT_ADMIN && !normalizedDivisionId) {
      throw new ApiError(400, 'divisionId is required for District Admin');
    }

    if (role === USER_ROLES.DISTRICT_ADMIN && !normalizedDistrictId) {
      throw new ApiError(400, 'districtId is required for District Admin');
    }

    if (role === USER_ROLES.UPAZILA_ADMIN && (!normalizedDistrictId || !normalizedUpazilaId)) {
      throw new ApiError(400, 'districtId and upazilaId are required for Upazila Admin');
    }

    if (role === USER_ROLES.UNION_LEADER || role === USER_ROLES.DONOR || role === USER_ROLES.FINDER) {
      if (!normalizedDivisionId || !normalizedDistrictId || !normalizedUpazilaId) {
        throw new ApiError(
          400,
          'divisionId, districtId, and upazilaId are required for this role',
        );
      }

      if (!normalizedAreaType || !['union', 'pouroshava'].includes(normalizedAreaType)) {
        throw new ApiError(400, 'areaType must be union or pouroshava for this role');
      }

      if (!normalizedUnionId && !unionName) {
        throw new ApiError(400, 'unionId or unionName is required for this role');
      }

      if (normalizedAreaType === 'pouroshava' && !normalizedWardNumber) {
        throw new ApiError(400, 'wardNumber is required for pouroshava locations');
      }
    }

    const normalizedUnionName = unionName?.trim() || null;

    return {
      divisionId: normalizedDivisionId,
      districtId: normalizedDistrictId,
      upazilaId: normalizedUpazilaId,
      areaType: normalizedAreaType,
      unionId: normalizedUnionId,
      unionName: normalizedUnionName,
      wardNumber: normalizedWardNumber,
      locationNames: {
        division: resolvedDivision?.name || null,
        district: resolvedDistrict?.name || null,
        upazila: resolvedUpazila?.name || null,
        union: resolvedUnion?.name || normalizedUnionName || null,
        wardNumber: normalizedWardNumber,
      },
    };
  },
};
