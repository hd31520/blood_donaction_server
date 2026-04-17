import mongoose from 'mongoose';

import { USER_ROLES } from '../config/access-control.js';
import { Division } from '../models/division.model.js';
import { District } from '../models/district.model.js';
import { Union } from '../models/union.model.js';
import { Upazila } from '../models/upazila.model.js';
import { ApiError } from '../shared/utils/api-error.js';
import { locationDatasetService } from './location-dataset.service.js';

const toCode = (prefix, id) => `${prefix}-${String(id).padStart(4, '0')}`;

const toExternalId = (value) => {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    return Number.parseInt(value.trim(), 10);
  }

  return null;
};

const upsertEntityByExternalId = async ({ Model, externalId, payload }) => {
  try {
    return await Model.findOneAndUpdate(
      { externalId },
      { $setOnInsert: payload },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    )
      .select('_id')
      .lean();
  } catch (error) {
    if (error?.code === 11000) {
      return Model.findOne({ externalId }).select('_id').lean();
    }

    throw error;
  }
};

const ensureDivisionByExternalId = async (externalId) => {
  const existing = await Division.findOne({ externalId }).select('_id').lean();
  if (existing?._id) {
    return existing;
  }

  const division = locationDatasetService.findDivision(externalId);
  if (!division) {
    return null;
  }

  return upsertEntityByExternalId({
    Model: Division,
    externalId,
    payload: {
      name: division.name,
      bnName: division.bnName || null,
      code: division.code || toCode('DIV', externalId),
      externalId,
    },
  });
};

const ensureDistrictByExternalId = async (externalId) => {
  const existing = await District.findOne({ externalId }).select('_id').lean();
  if (existing?._id) {
    return existing;
  }

  const district = locationDatasetService.findDistrict(externalId);
  if (!district) {
    return null;
  }

  const division = await ensureDivisionByExternalId(district.divisionId);
  if (!division?._id) {
    return null;
  }

  return upsertEntityByExternalId({
    Model: District,
    externalId,
    payload: {
      divisionId: division._id,
      name: district.name,
      bnName: district.bnName || null,
      code: district.code || toCode('DIS', externalId),
      externalId,
    },
  });
};

const ensureUpazilaByExternalId = async (externalId) => {
  const existing = await Upazila.findOne({ externalId }).select('_id').lean();
  if (existing?._id) {
    return existing;
  }

  const upazila = locationDatasetService.findUpazila(externalId);
  if (!upazila) {
    return null;
  }

  const district = await ensureDistrictByExternalId(upazila.districtId);
  if (!district?._id) {
    return null;
  }

  const districtDoc = await District.findById(district._id).select('divisionId').lean();
  if (!districtDoc?.divisionId) {
    return null;
  }

  return upsertEntityByExternalId({
    Model: Upazila,
    externalId,
    payload: {
      divisionId: districtDoc.divisionId,
      districtId: district._id,
      name: upazila.name,
      bnName: upazila.bnName || null,
      code: upazila.code || toCode('UPAZILA', externalId),
      externalId,
    },
  });
};

const ensureUnionByExternalId = async (externalId) => {
  const existing = await Union.findOne({ externalId }).select('_id').lean();
  if (existing?._id) {
    return existing;
  }

  const union = locationDatasetService.findUnion(externalId);
  if (!union) {
    return null;
  }

  const upazila = await ensureUpazilaByExternalId(union.upazilaId);
  if (!upazila?._id) {
    return null;
  }

  const upazilaDoc = await Upazila.findById(upazila._id).select('divisionId districtId').lean();
  if (!upazilaDoc?.divisionId || !upazilaDoc?.districtId) {
    return null;
  }

  return upsertEntityByExternalId({
    Model: Union,
    externalId,
    payload: {
      divisionId: upazilaDoc.divisionId,
      districtId: upazilaDoc.districtId,
      upazilaId: upazila._id,
      areaType: union.areaType || 'union',
      name: union.name,
      bnName: union.bnName || null,
      code: union.code || toCode('UNION', externalId),
      externalId,
    },
  });
};

const ensureEntityFromDataset = async (Model, externalId) => {
  if (Model === Division) {
    return ensureDivisionByExternalId(externalId);
  }

  if (Model === District) {
    return ensureDistrictByExternalId(externalId);
  }

  if (Model === Upazila) {
    return ensureUpazilaByExternalId(externalId);
  }

  if (Model === Union) {
    return ensureUnionByExternalId(externalId);
  }

  return null;
};

const resolveObjectId = async (Model, value, fieldName) => {
  if (!value) {
    return null;
  }

  // If it's already a valid ObjectId, use it directly
  if (mongoose.isValidObjectId(value)) {
    return new mongoose.Types.ObjectId(value);
  }

  // Try to convert to numeric ID (from public dataset)
  const externalId = toExternalId(value);
  if (externalId !== null) {
    const entity = await Model.findOne({ externalId }).select('_id').lean();
    if (entity?._id) {
      return new mongoose.Types.ObjectId(entity._id);
    }

    const hydratedEntity = await ensureEntityFromDataset(Model, externalId);
    if (hydratedEntity?._id) {
      return new mongoose.Types.ObjectId(hydratedEntity._id);
    }

    // If numeric but not found by externalId, try finding by ObjectId directly
    // This handles cases where the ID might be provided in ObjectId format
    if (mongoose.isValidObjectId(String(value))) {
      const fallbackEntity = await Model.findById(value).select('_id').lean();
      if (fallbackEntity?._id) {
        return new mongoose.Types.ObjectId(fallbackEntity._id);
      }
    }

    throw new ApiError(400, `${fieldName} with value "${value}" (externalId: ${externalId}) not found`);
  }

  throw new ApiError(400, `${fieldName} must be ObjectId or numeric externalId (got: "${value}")`);
};

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
    const normalizedWardNumber = wardNumber ? String(wardNumber).trim() : null;

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
