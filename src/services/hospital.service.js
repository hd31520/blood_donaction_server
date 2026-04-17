import mongoose from 'mongoose';

import { USER_ROLES, buildScopeFilter } from '../config/access-control.js';
import { Hospital } from '../models/hospital.model.js';
import { locationService } from './location.service.js';
import { ApiError } from '../shared/utils/api-error.js';

const sanitizeHospital = (doc) => ({
  id: doc._id,
  name: doc.name,
  divisionId: doc.divisionId,
  districtId: doc.districtId,
  upazilaId: doc.upazilaId,
  areaType: doc.areaType,
  unionId: doc.unionId || null,
  unionName: doc.unionName || null,
  wardNumber: doc.wardNumber || null,
  address: doc.address || null,
  phone: doc.phone || null,
  locationNames: {
    division: doc.locationNames?.division || null,
    district: doc.locationNames?.district || null,
    upazila: doc.locationNames?.upazila || null,
    union: doc.locationNames?.union || null,
    wardNumber: doc.locationNames?.wardNumber || null,
  },
  createdBy: doc.createdBy,
  createdAt: doc.createdAt,
});

const assertAdminCanCreateHospital = (actor) => {
  if (
    actor.role !== USER_ROLES.SUPER_ADMIN &&
    actor.role !== USER_ROLES.DISTRICT_ADMIN &&
    actor.role !== USER_ROLES.UPAZILA_ADMIN
  ) {
    throw new ApiError(403, 'Only super admin, district admin, and upazila admin can create hospitals');
  }
};

const applyActorScopeToHospital = (actor, payload) => {
  const scoped = { ...payload };

  if (actor.role === USER_ROLES.DISTRICT_ADMIN) {
    scoped.districtId = actor.districtId;
  }

  if (actor.role === USER_ROLES.UPAZILA_ADMIN) {
    scoped.districtId = actor.districtId;
    scoped.upazilaId = actor.upazilaId;
  }

  return scoped;
};

const buildHospitalFilter = (actor, filters) => {
  const query = {};

  if (actor.role === USER_ROLES.SUPER_ADMIN) {
    // no scope restriction
  } else if (actor.role === USER_ROLES.DISTRICT_ADMIN) {
    query.districtId = actor.districtId;
  } else if (
    actor.role === USER_ROLES.UPAZILA_ADMIN ||
    actor.role === USER_ROLES.FINDER ||
    actor.role === USER_ROLES.DONOR ||
    actor.role === USER_ROLES.UNION_LEADER ||
    actor.role === USER_ROLES.WARD_ADMIN
  ) {
    query.districtId = actor.districtId;
    query.upazilaId = actor.upazilaId;
  } else {
    // fallback for other roles using available scope
    Object.assign(query, buildScopeFilter(actor));
  }

  const objectIdFilters = [
    ['divisionId', filters.divisionId],
    ['districtId', filters.districtId],
    ['upazilaId', filters.upazilaId],
  ];

  objectIdFilters.forEach(([field, value]) => {
    if (!value) {
      return;
    }

    if (!mongoose.isValidObjectId(value)) {
      throw new ApiError(400, `${field} must be a valid ObjectId`);
    }

    query[field] = new mongoose.Types.ObjectId(value);
  });

  return query;
};

export const hospitalService = {
  createHospital: async (actor, payload) => {
    assertAdminCanCreateHospital(actor);

    const scopedPayload = applyActorScopeToHospital(actor, payload);
    const normalizedLocation = await locationService.normalizeAndValidateHierarchy({
      divisionId: scopedPayload.divisionId,
      districtId: scopedPayload.districtId,
      upazilaId: scopedPayload.upazilaId,
      areaType: scopedPayload.areaType,
      unionId: scopedPayload.unionId,
      unionName: scopedPayload.unionName,
      wardNumber: scopedPayload.wardNumber,
      role: USER_ROLES.DONOR,
    });

    const hospital = await Hospital.create({
      name: scopedPayload.name,
      ...normalizedLocation,
      address: scopedPayload.address,
      phone: scopedPayload.phone,
      createdBy: actor._id,
    });

    return sanitizeHospital(hospital);
  },

  listHospitals: async (actor, filters = {}) => {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
    const query = buildHospitalFilter(actor, filters);

    const [data, total] = await Promise.all([
      Hospital.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Hospital.countDocuments(query),
    ]);

    return {
      data: data.map(sanitizeHospital),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },
};
